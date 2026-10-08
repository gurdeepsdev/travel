import Database from "../../database/database-manager.js";
import { createHash } from "node:crypto";
import { resolveStoragePath } from "../../providers/storage/local.provider.js";
import Repository from "./chat.repository.js";
import AppError from "../../core/errors/app-error.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";
import { scanChatAttachment } from "./chat-malware.service.js";

const fail = (code, message, statusCode) => {
  throw new AppError({ code: `CHAT.${code}`, message, statusCode });
};
const map = (row) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sent_by,
  clientMessageId: row.client_message_id,
  type: row.message_type,
  text: row.deleted_at ? null : row.message_content,
  replyToMessageId: row.reply_to_message_id,
  deleted: Boolean(row.deleted_at),
  itineraryId: row.deleted_at ? null : row.itinerary_id,
  assets: row.deleted_at ? [] : (row.assets ?? []),
  createdAt: row.created_at,
  editedAt: row.edited_at,
  reactions: row.deleted_at ? [] : (row.reactions ?? []),
  receipts: row.receipts ?? [],
});
async function event(client, conversationId, messageId, type) {
  await client.query(
    "INSERT INTO chat.event_outbox (conversation_id,message_id,event_type) VALUES ($1,$2,$3)",
    [conversationId, messageId, type],
  );
}
async function withAttachments(client, message) {
  const { rows } = await client.query(
    `SELECT a.id,a.mime_type AS "mimeType",a.file_size AS "fileSize",
    '/api/v1/chat/conversations/'||$2::text||'/messages/'||$1::text||'/attachments/'||a.id AS url
    FROM chat.message_assets ma JOIN media.assets a ON a.id=ma.asset_id AND a.deleted_at IS NULL
    WHERE ma.message_id=$1::uuid ORDER BY ma.display_order`,
    [message.id, message.conversation_id],
  );
  return map({ ...message, assets: rows });
}

export async function authorize(client, conversationId, userId, write = false) {
  const conversation = await Repository.access(client, conversationId, userId);
  if (!conversation)
    fail("CONVERSATION_NOT_FOUND", "Conversation is unavailable.", 404);
  if (
    write &&
    (conversation.request_status !== "ACCEPTED" || !conversation.can_send)
  )
    fail("SEND_NOT_ALLOWED", "Sending messages is not allowed.", 403);
  return conversation;
}

export class ChatMessagesService {
  async send(userId, conversationId, input, { requestMessage = false } = {}) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1::uuid FOR UPDATE",
        [conversationId],
      );
      const conversation = await authorize(
        client,
        conversationId,
        userId,
        !requestMessage,
      );
      if (
        requestMessage &&
        (conversation.conversation_type !== "direct" ||
          conversation.requested_by !== userId ||
          !input.text ||
          input.assetIds ||
          input.itineraryId ||
          input.replyToMessageId)
      )
        fail(
          "SEND_NOT_ALLOWED",
          "Only the requester can send initial request text.",
          403,
        );
      const payloadHash = createHash("sha256")
        .update(
          JSON.stringify([
            input.text ?? null,
            input.replyToMessageId ?? null,
            input.itineraryId ?? null,
            input.assetIds ?? [],
          ]),
        )
        .digest("hex");
      const {
        rows: [existing],
      } = await client.query(
        "SELECT * FROM chat.chat_messages WHERE conversation_id=$1 AND sent_by=$2 AND client_message_id=$3",
        [conversationId, userId, input.clientMessageId],
      );
      if (existing) {
        if (existing.client_payload_hash !== payloadHash)
          fail(
            "CLIENT_MESSAGE_CONFLICT",
            "Client message ID was already used for different content.",
            409,
          );
        return {
          message: await withAttachments(client, existing),
          created: false,
        };
      }
      if (requestMessage) {
        const { rows } = await client.query(
          "SELECT id FROM chat.chat_messages WHERE conversation_id=$1 LIMIT 1",
          [conversationId],
        );
        if (conversation.request_status !== "PENDING" || rows.length)
          fail(
            "REQUEST_MESSAGE_NOT_ALLOWED",
            "Only one initial text is allowed while the request is pending.",
            409,
          );
      }
      if (input.replyToMessageId) {
        const { rows } = await client.query(
          "SELECT id FROM chat.chat_messages m WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$3)",
          [input.replyToMessageId, conversationId, userId],
        );
        if (!rows.length)
          fail("REPLY_NOT_FOUND", "Reply target is unavailable.", 404);
      }
      if (input.itineraryId) {
        const { rows } = await client.query(
          `SELECT id FROM itinerary.itineraries i WHERE id=$1 AND deleted_at IS NULL AND
          (created_by=$2 OR EXISTS(SELECT 1 FROM groups.groups g JOIN groups.group_members m ON m.group_id=g.id
           WHERE g.itinerary_id=i.id AND g.deleted_at IS NULL AND g.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=$2))`,
          [input.itineraryId, userId],
        );
        if (!rows.length)
          fail("ITINERARY_NOT_ALLOWED", "Itinerary cannot be shared.", 404);
      }
      let type = input.itineraryId ? "ITINERARY" : "TEXT";
      if (input.assetIds) {
        const { rows } = await client.query(
          "SELECT id,mime_type,storage_key FROM media.assets WHERE id=ANY($1::uuid[]) AND uploaded_by=$2 AND deleted_at IS NULL AND processing_status='READY' AND storage_provider='local' FOR SHARE",
          [input.assetIds, userId],
        );
        if (rows.length !== input.assetIds.length)
          fail("ASSET_NOT_ALLOWED", "Attachments are unavailable.", 404);
        const deadline = Date.now() + 30000;
        for (const asset of rows) {
          const remaining = deadline - Date.now();
          if (remaining <= 0)
            fail(
              "MALWARE_SCAN_UNAVAILABLE",
              "Attachment scanning is unavailable. Retry later.",
              503,
            );
          await scanChatAttachment(resolveStoragePath(asset.storage_key), {
            timeoutMs: remaining,
          });
        }
        type = rows.every((a) => a.mime_type.startsWith("image/"))
          ? "IMAGE"
          : rows.every((a) => a.mime_type.startsWith("video/"))
            ? "VIDEO"
            : "DOCUMENT";
      }
      const {
        rows: [message],
      } = await client.query(
        `INSERT INTO chat.chat_messages
        (conversation_id,sent_by,message_type,message_content,client_message_id,reply_to_message_id,client_payload_hash,itinerary_id)
        VALUES ($1,$2,$7,$3,$4,$5,$6,$8) RETURNING *`,
        [
          conversationId,
          userId,
          input.text ?? (input.itineraryId ? "Shared itinerary" : "Attachment"),
          input.clientMessageId,
          input.replyToMessageId ?? null,
          payloadHash,
          type,
          input.itineraryId ?? null,
        ],
      );
      for (const [index, assetId] of (input.assetIds ?? []).entries())
        await client.query(
          "INSERT INTO chat.message_assets (message_id,asset_id,display_order) VALUES ($1,$2,$3)",
          [message.id, assetId, index + 1],
        );
      await client.query(
        "UPDATE chat.conversations SET last_message_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [conversationId, message.id],
      );
      await event(client, conversationId, message.id, "message.created");
      return { message: await withAttachments(client, message), created: true };
    });
  }
  async history(userId, conversationId, { limit, cursor }) {
    return Database.transaction(async (client) => {
      await authorize(client, conversationId, userId);
      const position = decodeCursor(cursor);
      const { rows } = await client.query(
        `SELECT m.*,m.created_at::text AS cursor_time,
        (SELECT jsonb_agg(jsonb_build_object('userId',r.user_id,'reaction',r.reaction)) FROM chat.message_reactions r WHERE r.message_id=m.id) AS reactions,
        (SELECT jsonb_agg(jsonb_build_object('userId',r.user_id,'deliveredAt',r.delivered_at,'readAt',r.read_at)) FROM chat.message_receipts r WHERE r.message_id=m.id) AS receipts
        ,(SELECT jsonb_agg(jsonb_build_object('id',a.id,'mimeType',a.mime_type,'fileSize',a.file_size,'url','/api/v1/chat/conversations/'||m.conversation_id||'/messages/'||m.id||'/attachments/'||a.id) ORDER BY ma.display_order)
          FROM chat.message_assets ma JOIN media.assets a ON a.id=ma.asset_id AND a.deleted_at IS NULL WHERE ma.message_id=m.id) AS assets
        ,jsonb_build_object('id',m.sent_by,'username',profile.username,'displayName',profile.display_name,
          'profilePhoto',CASE WHEN photo.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id',photo.id,'url','/api/v1/media/assets/'||photo.id||'/content','mimeType',photo.mime_type) END) AS sender
        FROM chat.chat_messages m
        LEFT JOIN users.profiles profile ON profile.user_id=m.sent_by AND profile.deleted_at IS NULL
        LEFT JOIN media.assets photo ON photo.id=profile.profile_photo_asset_id AND photo.deleted_at IS NULL
        WHERE m.conversation_id=$1 AND NOT EXISTS (SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$2)
        AND ($3::timestamp IS NULL OR (m.created_at,m.id)<($3::timestamp,$4::uuid))
        ORDER BY m.created_at DESC,m.id DESC LIMIT $5`,
        [
          conversationId,
          userId,
          position?.createdAt ?? null,
          position?.id ?? null,
          limit + 1,
        ],
      );
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        messages: page.map((row) => ({ ...map(row), sender: row.sender })),
        pagination: {
          hasMore,
          nextCursor: hasMore
            ? encodeCursor({ createdAt: last.cursor_time, id: last.id })
            : null,
        },
      };
    });
  }
  async mutate(userId, conversationId, messageId, action, input) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1::uuid FOR UPDATE",
        [conversationId],
      );
      await authorize(client, conversationId, userId, action === "edit");
      const {
        rows: [message],
      } = await client.query(
        `SELECT *, created_at >= CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '48 hours' AS deletable
        FROM chat.chat_messages WHERE id=$1 AND conversation_id=$2 FOR UPDATE`,
        [messageId, conversationId],
      );
      if (!message) fail("MESSAGE_NOT_FOUND", "Message is unavailable.", 404);
      if (action === "hide") {
        await client.query(
          "INSERT INTO chat.hidden_messages (message_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
          [messageId, userId],
        );
        return { hidden: true, messageId };
      }
      if (message.sent_by !== userId)
        fail(
          "MESSAGE_NOT_OWNED",
          "Only the sender can change this message.",
          403,
        );
      if (action === "delete" && message.deleted_at)
        return { message: map(message) };
      if (message.deleted_at)
        fail("MESSAGE_DELETED", "Message was deleted.", 409);
      if (action === "delete" && !message.deletable)
        fail(
          "DELETE_WINDOW_EXPIRED",
          "Delete-for-everyone is limited to 48 hours.",
          403,
        );
      if (action === "edit" && message.message_type !== "TEXT")
        fail("EDIT_NOT_ALLOWED", "Only text messages can be edited.", 403);
      const {
        rows: [updated],
      } = await client.query(
        action === "delete"
          ? "UPDATE chat.chat_messages SET deleted_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *"
          : "UPDATE chat.chat_messages SET message_content=$2,edited_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *",
        action === "delete" ? [messageId] : [messageId, input.text],
      );
      await event(
        client,
        conversationId,
        messageId,
        action === "delete" ? "message.deleted" : "message.edited",
      );
      return { message: map(updated) };
    });
  }
  async react(userId, conversationId, messageId, reaction, remove = false) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1 FOR UPDATE",
        [conversationId],
      );
      const conversation = await authorize(client, conversationId, userId);
      if (conversation.request_status !== "ACCEPTED")
        fail("REACTION_NOT_ALLOWED", "Accept the message request first.", 403);
      const { rows } = await client.query(
        "SELECT id FROM chat.chat_messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [messageId, conversationId],
      );
      if (!rows.length)
        fail("MESSAGE_NOT_FOUND", "Message is unavailable.", 404);
      if (remove)
        await client.query(
          "DELETE FROM chat.message_reactions WHERE message_id=$1 AND user_id=$2 AND reaction=$3",
          [messageId, userId, reaction],
        );
      else
        await client.query(
          "INSERT INTO chat.message_reactions (message_id,user_id,reaction) VALUES ($1,$2,$3) ON CONFLICT (message_id,user_id,reaction) DO NOTHING",
          [messageId, userId, reaction],
        );
      await event(client, conversationId, messageId, "message.reaction");
      return { messageId, reaction, removed: remove };
    });
  }
  async receipt(userId, conversationId, messageId, status) {
    return Database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM chat.conversations WHERE id=$1 FOR UPDATE",
        [conversationId],
      );
      await authorize(client, conversationId, userId);
      const { rows } = await client.query(
        "SELECT id FROM chat.chat_messages WHERE id=$1 AND conversation_id=$2",
        [messageId, conversationId],
      );
      if (!rows.length)
        fail("MESSAGE_NOT_FOUND", "Message is unavailable.", 404);
      const {
        rows: [receipt],
      } = await client.query(
        `INSERT INTO chat.message_receipts (message_id,user_id,read_at)
        VALUES ($1,$2,CASE WHEN $3='READ' THEN CURRENT_TIMESTAMP ELSE NULL END)
        ON CONFLICT (message_id,user_id) DO UPDATE SET read_at=COALESCE(chat.message_receipts.read_at,EXCLUDED.read_at) RETURNING *`,
        [messageId, userId, status],
      );
      await event(client, conversationId, messageId, "message.receipt");
      return {
        messageId,
        status: receipt.read_at ? "READ" : "DELIVERED",
        deliveredAt: receipt.delivered_at,
        readAt: receipt.read_at,
      };
    });
  }
  async itinerary(userId, conversationId, messageId) {
    return Database.transaction(async (client) => {
      await authorize(client, conversationId, userId);
      const {
        rows: [itinerary],
      } = await client.query(
        `SELECT i.id,i.created_by AS "ownerId",i.title,i.duration_days AS "durationDays",i.itinerary_json AS "itineraryJson",i.created_at AS "createdAt",i.updated_at AS "updatedAt"
        FROM chat.chat_messages m JOIN itinerary.itineraries i ON i.id=m.itinerary_id AND i.deleted_at IS NULL
        WHERE m.id=$1 AND m.conversation_id=$2 AND m.deleted_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$3)`,
        [messageId, conversationId, userId],
      );
      if (!itinerary)
        fail("ITINERARY_NOT_FOUND", "Shared itinerary is unavailable.", 404);
      return { itinerary, readOnly: true };
    });
  }
  async attachment(userId, conversationId, messageId, assetId) {
    return Database.transaction(async (client) => {
      await authorize(client, conversationId, userId);
      const {
        rows: [asset],
      } = await client.query(
        `SELECT a.storage_key,a.mime_type FROM chat.chat_messages m
        JOIN chat.message_assets ma ON ma.message_id=m.id JOIN media.assets a ON a.id=ma.asset_id
        WHERE m.id=$1 AND m.conversation_id=$2 AND ma.asset_id=$3 AND m.deleted_at IS NULL AND a.deleted_at IS NULL
          AND a.storage_provider='local' AND a.processing_status='READY'
          AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=$4)`,
        [messageId, conversationId, assetId, userId],
      );
      if (!asset) fail("ASSET_NOT_FOUND", "Attachment is unavailable.", 404);
      return {
        filePath: resolveStoragePath(asset.storage_key),
        mimeType: asset.mime_type,
      };
    });
  }
}
export default new ChatMessagesService();
