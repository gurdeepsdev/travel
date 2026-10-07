import Database from "../../database/database-manager.js";
import AppError from "../../core/errors/app-error.js";

export const mapEvent = (row) => ({
  eventId: String(row.event_id),
  replayCursor: String(row.sequence),
  conversationId: row.conversation_id,
  conversationSequence:
    row.conversation_sequence == null
      ? null
      : String(row.conversation_sequence),
  messageId: row.message_id ?? null,
  type: row.event_type,
});

export async function recordUserEvent(client, userId, event) {
  await client.query(
    "INSERT INTO chat.event_cursors(user_id) VALUES($1) ON CONFLICT DO NOTHING",
    [userId],
  );
  await client.query(
    "SELECT sequence FROM chat.event_cursors WHERE user_id=$1 FOR UPDATE",
    [userId],
  );
  const {
    rows: [existing],
  } = await client.query(
    "SELECT * FROM chat.user_events WHERE user_id=$1 AND event_id=$2",
    [userId, event.id],
  );
  if (existing) return mapEvent(existing);
  const {
    rows: [cursor],
  } = await client.query(
    "UPDATE chat.event_cursors SET sequence=sequence+1 WHERE user_id=$1 RETURNING sequence",
    [userId],
  );
  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO chat.user_events(user_id,sequence,event_id,conversation_id,message_id,event_type,conversation_sequence)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      userId,
      cursor.sequence,
      event.id,
      event.conversation_id,
      event.message_id,
      event.event_type,
      event.conversation_sequence ?? null,
    ],
  );
  return mapEvent(row);
}

export async function recordUserEventBatch(client, userIds, event) {
  if (!userIds.length) return [];
  if (userIds.length > 500)
    throw new RangeError("Chat journal batch exceeds 500 recipients.");
  await client.query(
    `INSERT INTO chat.event_cursors(user_id)
    SELECT DISTINCT id FROM unnest($1::uuid[]) id ORDER BY id ON CONFLICT DO NOTHING`,
    [userIds],
  );
  // Sorted locks make overlapping batches safe across concurrent transactions.
  await client.query(
    "SELECT user_id FROM chat.event_cursors WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE",
    [userIds],
  );
  const { rows } = await client.query(
    `WITH advanced AS (
    UPDATE chat.event_cursors c SET sequence=c.sequence+1 WHERE c.user_id=ANY($1::uuid[])
      AND NOT EXISTS(SELECT 1 FROM chat.user_events e WHERE e.user_id=c.user_id AND e.event_id=$2::bigint)
      RETURNING c.user_id,c.sequence
    ), inserted AS (
      INSERT INTO chat.user_events(user_id,sequence,event_id,conversation_id,message_id,event_type,conversation_sequence)
      SELECT user_id,sequence,$2::bigint,$3::uuid,$4::uuid,$5,$6::bigint FROM advanced RETURNING *
    ) SELECT * FROM inserted UNION ALL SELECT e.* FROM chat.user_events e
      WHERE e.user_id=ANY($1::uuid[]) AND e.event_id=$2::bigint`,
    [
      userIds,
      event.id,
      event.conversation_id,
      event.message_id ?? null,
      event.event_type,
      event.conversation_sequence ?? null,
    ],
  );
  return rows.map((row) => ({ userId: row.user_id, payload: mapEvent(row) }));
}

export default {
  async replay(userId, { after, limit = 100 }) {
    // One SQL snapshot prevents a cursor advancing beyond events visible to this read.
    const {
      rows: [result],
    } = await Database.query(
      `WITH state AS (
      SELECT COALESCE((SELECT sequence FROM chat.event_cursors WHERE user_id=$1),0) AS current,
        (SELECT MIN(sequence) FROM chat.user_events WHERE user_id=$1 AND created_at>clock_timestamp()-INTERVAL '7 days') AS oldest
    ), page AS (
      SELECT e.* FROM chat.user_events e,state s WHERE e.user_id=$1 AND e.sequence>$2::bigint
        AND e.sequence<=s.current AND e.created_at>clock_timestamp()-INTERVAL '7 days'
        AND EXISTS(SELECT 1 FROM chat.accessible_conversations($1) c WHERE c.id=e.conversation_id)
        AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=e.message_id AND h.user_id=$1)
      ORDER BY e.sequence LIMIT $3
    ) SELECT current::text,oldest::text,COALESCE((SELECT jsonb_agg(to_jsonb(page)||jsonb_build_object('sequence',page.sequence::text,'event_id',page.event_id::text,'conversation_sequence',page.conversation_sequence::text) ORDER BY sequence) FROM page),'[]') AS events FROM state`,
      [userId, after ?? "0", limit + 1],
    );
    const current = BigInt(result.current),
      position = BigInt(after ?? "0");
    if (position > current)
      throw new AppError({
        code: "CHAT.INVALID_REPLAY_CURSOR",
        message: "Replay cursor is ahead of this account.",
        statusCode: 409,
      });
    const floor = result.oldest ? BigInt(result.oldest) - 1n : current;
    if (after === undefined || position < floor)
      return {
        events: [],
        nextCursor: result.current,
        hasMore: false,
        resyncRequired: true,
      };
    const hasMore = result.events.length > limit,
      page = result.events.slice(0, limit);
    return {
      events: page.map(mapEvent),
      nextCursor: hasMore ? String(page.at(-1).sequence) : result.current,
      hasMore,
      resyncRequired: false,
    };
  },
};
