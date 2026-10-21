import {
  describeItineraryChanges,
  requestNoticeText,
} from "./itinerary-poi-changes.js";

export async function publishRequestNotice(client, request, actorId) {
  const { rows: groups } = await client.query(
    `
    INSERT INTO chat.conversations(conversation_type,group_id,request_status)
    SELECT 'group',g.id,'ACCEPTED' FROM groups.groups g
    WHERE g.itinerary_id=$1 AND g.status='ACTIVE' AND g.deleted_at IS NULL
    ON CONFLICT(group_id) DO UPDATE SET group_id=EXCLUDED.group_id
    RETURNING id`,
    [request.itinerary_id],
  );
  if (!groups.length) return;
  const {
    rows: [profile],
  } = await client.query(
    `SELECT
    COALESCE(NULLIF(display_name,''),username,'A member') AS name
    FROM users.profiles WHERE user_id=$1 AND deleted_at IS NULL`,
    [actorId],
  );
  const actor = (profile?.name ?? "A member").slice(0, 150);
  const changes =
    request.notice_changes ??
    (request.status === "PENDING"
      ? null
      : await describeItineraryChanges(
          client,
          request.base_days,
          request.proposed_data?.days,
        ));
  const text =
    request.status === "PENDING"
      ? `${actor} requested itinerary changes.`
      : request.status === "STALE"
        ? "An itinerary change proposal is outdated because its original place was already changed. Unrelated changes remain available."
        : requestNoticeText(actor, request.status, changes);
  for (const conversation of groups) {
    const {
      rows: [notice],
    } = await client.query(
      `INSERT INTO chat.chat_messages
      (conversation_id,sent_by,message_type,message_content,itinerary_id,change_request_id,change_request_status,change_request_changes,change_request_review_id)
      VALUES($1,$2,'SYSTEM',$3,$4,$5,$6,$7::jsonb,$8::uuid)
      ON CONFLICT DO NOTHING RETURNING id`,
      [
        conversation.id,
        actorId,
        text,
        request.itinerary_id,
        request.id,
        request.status,
        changes === null ? null : JSON.stringify(changes),
        request.review_id ?? null,
      ],
    );
    if (!notice) continue;
    await client.query(
      `UPDATE chat.conversations SET last_message_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [conversation.id, notice.id],
    );
    await client.query(
      `INSERT INTO chat.event_outbox(conversation_id,message_id,event_type) VALUES($1,$2,'message.created')`,
      [conversation.id, notice.id],
    );
  }
}
