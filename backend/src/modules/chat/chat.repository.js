import Database from "../../database/database-manager.js";

export class ChatRepository {
  async recipients(client, conversationId, userIds = null) {
    const { rows } = await client.query(
      `WITH candidates AS (
      SELECT user_id FROM chat.conversation_participants WHERE conversation_id=$1 AND left_at IS NULL
      UNION SELECT g.owner_id FROM chat.conversations c JOIN groups.groups g ON g.id=c.group_id WHERE c.id=$1
      UNION SELECT m.user_id FROM chat.conversations c JOIN groups.group_members m ON m.group_id=c.group_id AND m.status='ACTIVE' WHERE c.id=$1
      UNION SELECT cm.owner_id FROM chat.conversations c JOIN community.communities cm ON cm.id=c.community_id WHERE c.id=$1
      UNION SELECT m.user_id FROM chat.conversations c JOIN community.community_members m ON m.community_id=c.community_id AND upper(m.status)='ACTIVE' WHERE c.id=$1
    ) SELECT u.id AS user_id FROM candidates r JOIN auth.users u ON u.id=r.user_id AND u.status='ACTIVE'
    WHERE ($2::uuid[] IS NULL OR u.id=ANY($2::uuid[])) AND EXISTS(
      SELECT 1 FROM chat.accessible_conversations(u.id) c WHERE c.id=$1)
    ORDER BY u.id`,
      [conversationId, userIds],
    );
    return rows;
  }
  async access(client, conversationId, userId) {
    const { rows } = await client.query(
      `
      SELECT c.*,
        CASE WHEN c.conversation_type <> 'community' THEN TRUE
          ELSE cm.owner_id = $2::uuid OR lower(m.role) IN ('owner', 'admin') END AS can_send
      FROM chat.conversations c
      LEFT JOIN groups.groups g ON g.id = c.group_id
      LEFT JOIN groups.group_members gm ON gm.group_id = g.id AND gm.user_id = $2::uuid AND gm.status = 'ACTIVE'
      LEFT JOIN community.communities cm ON cm.id = c.community_id
      LEFT JOIN community.community_members m ON m.community_id = cm.id AND m.user_id = $2::uuid AND upper(m.status) = 'ACTIVE'
      WHERE c.id = $1::uuid AND c.deleted_at IS NULL AND (
        (c.conversation_type = 'direct' AND EXISTS (
          SELECT 1 FROM chat.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = $2::uuid AND p.left_at IS NULL
        ) AND NOT EXISTS (
          SELECT 1 FROM chat.conversation_participants other JOIN users.blocked_users b
            ON (b.user_id = $2::uuid AND b.blocked_user_id = other.user_id)
            OR (b.blocked_user_id = $2::uuid AND b.user_id = other.user_id)
          WHERE other.conversation_id = c.id AND other.user_id <> $2::uuid
        )) OR
        (c.conversation_type = 'group' AND g.deleted_at IS NULL AND g.status = 'ACTIVE' AND (g.owner_id = $2::uuid OR gm.id IS NOT NULL)) OR
        (c.conversation_type = 'community' AND cm.deleted_at IS NULL AND (cm.owner_id = $2::uuid OR m.id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM community.community_bans b WHERE b.community_id = cm.id AND b.banned_user_id = $2::uuid))
      )`,
      [conversationId, userId],
    );
    return rows[0] ?? null;
  }

  async create(userId, input) {
    return Database.transaction(async (client) => {
      if (input.type === "direct") {
        if (userId === input.userId) return null;
        const pair = [userId, input.userId].sort();
        const key = pair.join(":");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [key],
        );
        const {
          rows: [target],
        } = await client.query(
          `
          SELECT u.id, EXISTS (SELECT 1 FROM users.connections WHERE user_low_id=$1::uuid AND user_high_id=$2::uuid) AS connected
          FROM auth.users u WHERE u.id=$3::uuid AND u.status = 'ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM users.blocked_users WHERE
            (user_id=$4::uuid AND blocked_user_id=$3::uuid) OR (user_id=$3::uuid AND blocked_user_id=$4::uuid))`,
          [...pair, input.userId, userId],
        );
        if (!target) return null;
        const {
          rows: [conversation],
        } = await client.query(
          `
          INSERT INTO chat.conversations (conversation_type, direct_key, request_status, requested_by)
          VALUES ('direct',$1,$2,$3::uuid)
          ON CONFLICT (direct_key) WHERE conversation_type='direct' DO UPDATE SET direct_key=EXCLUDED.direct_key
          RETURNING *`,
          [key, target.connected ? "ACCEPTED" : "PENDING", userId],
        );
        for (const participant of pair)
          await client.query(
            `
          INSERT INTO chat.conversation_participants (conversation_id,user_id)
          VALUES ($1::uuid,$2::uuid) ON CONFLICT (conversation_id,user_id) DO NOTHING`,
            [conversation.id, participant],
          );
        return this.access(client, conversation.id, userId);
      }
      const group = input.type === "group";
      const targetId = group ? input.groupId : input.communityId;
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`${input.type}:${targetId}`],
      );
      const {
        rows: [target],
      } = await client.query(
        group
          ? `
        SELECT g.id FROM groups.groups g WHERE g.id=$1::uuid AND g.deleted_at IS NULL AND g.status='ACTIVE'
        AND (g.owner_id=$2::uuid OR EXISTS (SELECT 1 FROM groups.group_members m WHERE m.group_id=g.id AND m.user_id=$2::uuid AND m.status='ACTIVE')) FOR SHARE`
          : `
        SELECT c.id FROM community.communities c WHERE c.id=$1::uuid AND c.deleted_at IS NULL
        AND (c.owner_id=$2::uuid OR EXISTS (SELECT 1 FROM community.community_members m WHERE m.community_id=c.id AND m.user_id=$2::uuid AND upper(m.status)='ACTIVE'))
        AND NOT EXISTS (SELECT 1 FROM community.community_bans b WHERE b.community_id=c.id AND b.banned_user_id=$2::uuid) FOR SHARE`,
        [targetId, userId],
      );
      if (!target) return null;
      const column = group ? "group_id" : "community_id";
      const {
        rows: [conversation],
      } = await client.query(
        `
        INSERT INTO chat.conversations (conversation_type,${column}) VALUES ($1,$2::uuid)
        ON CONFLICT (${column}) DO UPDATE SET ${column}=EXCLUDED.${column} RETURNING *`,
        [input.type, targetId],
      );
      return this.access(client, conversation.id, userId);
    });
  }

  async respond(conversationId, userId, status) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1::uuid FOR UPDATE",
        [conversationId],
      );
      const conversation = await this.access(client, conversationId, userId);
      if (
        !conversation ||
        conversation.conversation_type !== "direct" ||
        conversation.requested_by === userId
      )
        return null;
      if (conversation.request_status === status) return conversation;
      if (conversation.request_status !== "PENDING") return { conflict: true };
      const {
        rows: [result],
      } = await client.query(
        `UPDATE chat.conversations SET request_status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1::uuid RETURNING *`,
        [conversationId, status],
      );
      await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'request.responded')",
        [conversationId],
      );
      return result;
    });
  }
}

export default new ChatRepository();
