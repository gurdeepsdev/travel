import Database from "../../database/database-manager.js";
import { authorize } from "./chat-messages.service.js";
import { mapConversation } from "./chat.service.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";
import AppError from "../../core/errors/app-error.js";

const unreadSQL = `SELECT COUNT(*)::int FROM chat.chat_messages m WHERE m.conversation_id=c.id AND m.sent_by<>$1::uuid AND m.deleted_at IS NULL
 AND (s.last_read_at IS NULL OR (m.created_at,m.id)>(s.last_read_at,s.last_read_id))
 AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$1::uuid)
 AND NOT EXISTS(SELECT 1 FROM chat.message_receipts r WHERE r.message_id=m.id AND r.user_id=$1::uuid AND r.read_at IS NOT NULL)`;

export class ChatInboxService {
  async list(userId, { limit, cursor, archived, requests }) {
    const position = decodeCursor(cursor);
    const { rows } = await Database.query(
      `SELECT c.*,c.updated_at::text AS cursor_time,
      COALESCE(s.is_muted,false) AS is_muted,COALESCE(s.is_archived,false) AS is_archived,
      CASE WHEN c.conversation_type<>'community' THEN TRUE ELSE EXISTS(SELECT 1 FROM community.communities cm WHERE cm.id=c.community_id AND cm.owner_id=$1)
       OR EXISTS(SELECT 1 FROM community.community_members m WHERE m.community_id=c.community_id AND m.user_id=$1 AND upper(m.status)='ACTIVE' AND lower(m.role) IN ('owner','admin')) END AS can_send,
      (${unreadSQL}) AS unread_count,
      (SELECT jsonb_build_object('id',m.id,'senderId',m.sent_by,'type',m.message_type,'text',CASE WHEN m.deleted_at IS NULL THEN m.message_content ELSE NULL END,'deleted',m.deleted_at IS NOT NULL,'createdAt',m.created_at)
        FROM chat.chat_messages m WHERE m.conversation_id=c.id AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$1)
        ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message
      FROM chat.accessible_conversations($1::uuid) c LEFT JOIN chat.conversation_settings s ON s.conversation_id=c.id AND s.user_id=$1
      WHERE COALESCE(s.is_archived,false)=$2 AND ($3::boolean IS NULL OR (c.request_status='PENDING')=$3)
      AND ($4::timestamp IS NULL OR (c.updated_at,c.id)<($4::timestamp,$5::uuid))
      ORDER BY c.updated_at DESC,c.id DESC LIMIT $6`,
      [
        userId,
        archived,
        requests ?? null,
        position?.createdAt ?? null,
        position?.id ?? null,
        limit + 1,
      ],
    );
    const hasMore = rows.length > limit,
      page = rows.slice(0, limit),
      last = page.at(-1);
    return {
      conversations: page.map((row) => ({
        ...mapConversation(row),
        muted: row.is_muted,
        archived: row.is_archived,
        unreadCount: row.unread_count,
        lastMessage: row.last_message,
      })),
      pagination: {
        hasMore,
        nextCursor: hasMore
          ? encodeCursor({ createdAt: last.cursor_time, id: last.id })
          : null,
      },
    };
  }
  async unread(userId) {
    const {
      rows: [row],
    } = await Database.query(
      `SELECT COALESCE(SUM(unread_count),0)::int AS unread_count,COUNT(*) FILTER(WHERE unread_count>0)::int AS conversations_with_unread
      FROM(SELECT (${unreadSQL}) AS unread_count FROM chat.accessible_conversations($1::uuid) c
        LEFT JOIN chat.conversation_settings s ON s.conversation_id=c.id AND s.user_id=$1) counts`,
      [userId],
    );
    return {
      unreadCount: row.unread_count,
      conversationsWithUnread: row.conversations_with_unread,
    };
  }
  async settings(userId, id, input) {
    return Database.transaction(async (client) => {
      await authorize(client, id, userId);
      const {
        rows: [row],
      } = await client.query(
        `INSERT INTO chat.conversation_settings(conversation_id,user_id,is_muted,is_archived)
        VALUES($1,$2,COALESCE($3,false),COALESCE($4,false)) ON CONFLICT(conversation_id,user_id) DO UPDATE SET
        is_muted=COALESCE($3,chat.conversation_settings.is_muted),is_archived=COALESCE($4,chat.conversation_settings.is_archived),updated_at=CURRENT_TIMESTAMP RETURNING *`,
        [id, userId, input.muted ?? null, input.archived ?? null],
      );
      return {
        conversationId: id,
        muted: row.is_muted,
        archived: row.is_archived,
      };
    });
  }
  async read(userId, id, messageId) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1 FOR UPDATE",
        [id],
      );
      await authorize(client, id, userId);
      const {
        rows: [message],
      } = await client.query(
        "SELECT id,created_at::text AS created_at FROM chat.chat_messages WHERE conversation_id=$1 AND id=$2",
        [id, messageId],
      );
      if (!message)
        throw new AppError({
          code: "CHAT.MESSAGE_NOT_FOUND",
          message: "Message is unavailable.",
          statusCode: 404,
        });
      const {
        rows: [row],
      } = await client.query(
        `INSERT INTO chat.conversation_settings(conversation_id,user_id,last_read_at,last_read_id)
        VALUES($1,$2,$3::timestamp,$4) ON CONFLICT(conversation_id,user_id) DO UPDATE SET
        last_read_at=EXCLUDED.last_read_at,last_read_id=EXCLUDED.last_read_id,updated_at=CURRENT_TIMESTAMP
        WHERE chat.conversation_settings.last_read_at IS NULL OR (chat.conversation_settings.last_read_at,chat.conversation_settings.last_read_id)<(EXCLUDED.last_read_at,EXCLUDED.last_read_id)
        RETURNING last_read_id`,
        [id, userId, message.created_at, messageId],
      );
      if (row)
        await client.query(
          "INSERT INTO chat.event_outbox(conversation_id,message_id,event_type) VALUES($1,$2,'conversation.read')",
          [id, messageId],
        );
      return {
        conversationId: id,
        readThroughMessageId:
          row?.last_read_id ??
          (
            await client.query(
              "SELECT last_read_id FROM chat.conversation_settings WHERE conversation_id=$1 AND user_id=$2",
              [id, userId],
            )
          ).rows[0].last_read_id,
      };
    });
  }
  async report(userId, conversationId, messageId, input) {
    return Database.transaction(async (client) => {
      await authorize(client, conversationId, userId);
      const {
        rows: [message],
      } = await client.query(
        "SELECT id,sent_by FROM chat.chat_messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL",
        [messageId, conversationId],
      );
      if (!message)
        throw new AppError({
          code: "CHAT.MESSAGE_NOT_FOUND",
          message: "Message is unavailable.",
          statusCode: 404,
        });
      if (message.sent_by === userId)
        throw new AppError({
          code: "CHAT.REPORT_NOT_ALLOWED",
          message: "You cannot report your own message.",
          statusCode: 400,
        });
      const {
        rows: [report],
      } = await client.query(
        `INSERT INTO chat.message_reports(message_id,reporter_id,reason_code,description)
        VALUES($1,$2,$3,$4) ON CONFLICT(message_id,reporter_id) WHERE status IN('PENDING','UNDER_REVIEW')
        DO UPDATE SET message_id=EXCLUDED.message_id RETURNING id,status`,
        [messageId, userId, input.reasonCode, input.description ?? null],
      );
      return { reportId: report.id, status: report.status };
    });
  }
}
export default new ChatInboxService();
