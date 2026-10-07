import { GoogleAuth } from "google-auth-library";
import axios from "axios";
import Database from "../database/database-manager.js";
import logger from "../core/logger/logger.js";

let timer,
  busy = false;
const enabled = () => process.env.CHAT_PUSH_ENABLED === "true";
let auth;
export async function sendChatPush(row) {
  const project = process.env.CHAT_FCM_PROJECT_ID;
  if (!project || !process.env.CHAT_FCM_CREDENTIALS_FILE)
    throw Object.assign(new Error("Push configuration missing"), {
      code: "FCM_CONFIGURATION",
    });
  auth ??= new GoogleAuth({
    keyFile: process.env.CHAT_FCM_CREDENTIALS_FILE,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const token = await auth.getAccessToken();
  if (!token)
    throw Object.assign(new Error("OAuth token unavailable"), {
      code: "FCM_AUTH",
    });
  await axios.post(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`,
    {
      message: {
        token: row.token,
        notification: {
          title: "New message",
          body: "Open Artictern to view it.",
        },
        data: {
          conversationId: row.conversation_id,
          messageId: row.message_id,
          eventId: String(row.event_id),
        },
      },
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
      maxRedirects: 0,
    },
  );
}
export async function enqueueChatPush(client, event) {
  if (!enabled() || event.event_type !== "message.created") return;
  await client.query(
    `INSERT INTO chat.push_outbox(event_id,conversation_id,message_id,device_id)
    SELECT $1,$2,$3,d.id FROM chat.push_devices d JOIN chat.chat_messages m ON m.id=$3
    JOIN auth.users u ON u.id=d.user_id AND u.status='ACTIVE'
    JOIN auth.sessions a ON a.id=d.session_id AND a.expires_at>CURRENT_TIMESTAMP
    WHERE d.enabled AND d.user_id<>m.sent_by AND EXISTS(SELECT 1 FROM chat.accessible_conversations(d.user_id) c WHERE c.id=$2 AND c.request_status='ACCEPTED')
    AND NOT EXISTS(SELECT 1 FROM chat.conversation_settings s WHERE s.conversation_id=$2 AND s.user_id=d.user_id AND (s.is_muted OR s.is_archived))
    ON CONFLICT(event_id,device_id) DO NOTHING`,
    [event.id, event.conversation_id, event.message_id],
  );
}
export async function processChatPush(send = sendChatPush) {
  if (busy || !enabled()) return;
  busy = true;
  try {
    await Database.transaction(async (client) => {
      const { rows } =
        await client.query(`SELECT p.*,d.token,d.user_id FROM chat.push_outbox p JOIN chat.push_devices d ON d.id=p.device_id
        WHERE p.completed_at IS NULL AND p.next_attempt_at<=CURRENT_TIMESTAMP ORDER BY p.id LIMIT 5 FOR UPDATE OF p SKIP LOCKED`);
      for (const row of rows) {
        const { rows: eligible } = await client.query(
          `SELECT 1 FROM chat.push_devices d JOIN auth.sessions a ON a.id=d.session_id
          JOIN auth.users u ON u.id=d.user_id JOIN chat.chat_messages m ON m.id=$2
          WHERE d.id=$1 AND d.enabled AND u.status='ACTIVE' AND a.expires_at>CURRENT_TIMESTAMP AND m.deleted_at IS NULL
          AND EXISTS(SELECT 1 FROM chat.accessible_conversations(d.user_id) c WHERE c.id=$3 AND c.request_status='ACCEPTED')
          AND NOT EXISTS(SELECT 1 FROM chat.hidden_messages h WHERE h.message_id=m.id AND h.user_id=d.user_id)
          AND NOT EXISTS(SELECT 1 FROM chat.message_receipts r WHERE r.message_id=m.id AND r.user_id=d.user_id AND r.read_at IS NOT NULL)
          AND NOT EXISTS(SELECT 1 FROM chat.conversation_settings s WHERE s.conversation_id=$3 AND s.user_id=d.user_id AND
            (s.is_muted OR s.is_archived OR (s.last_read_at,s.last_read_id)>=(m.created_at,m.id)))`,
          [row.device_id, row.message_id, row.conversation_id],
        );
        if (!eligible.length) {
          await client.query(
            "UPDATE chat.push_outbox SET completed_at=CURRENT_TIMESTAMP,failure_code=$2 WHERE id=$1",
            [row.id, "SUPPRESSED"],
          );
          continue;
        }
        try {
          await send(row);
          await client.query(
            "UPDATE chat.push_outbox SET completed_at=CURRENT_TIMESTAMP,attempts=attempts+1 WHERE id=$1",
            [row.id],
          );
        } catch (error) {
          const unregistered = error.response?.data?.error?.details?.some(
            (detail) => detail.errorCode === "UNREGISTERED",
          );
          const attempts = row.attempts + 1;
          if (unregistered)
            await client.query(
              "UPDATE chat.push_devices SET enabled=false WHERE id=$1",
              [row.device_id],
            );
          const code = unregistered ? "UNREGISTERED" : "FCM_SEND_FAILED";
          await client.query(
            `UPDATE chat.push_outbox SET attempts=$2,failure_code=$3,
            completed_at=CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END,
            next_attempt_at=CURRENT_TIMESTAMP+($5 * INTERVAL '1 second') WHERE id=$1`,
            [
              row.id,
              attempts,
              code,
              unregistered || attempts >= 5,
              Math.min(3600, 60 * 2 ** attempts),
            ],
          );
          logger.warn({ code }, "Chat push delivery failed.");
        }
      }
    });
  } catch (error) {
    logger.error(
      {
        code:
          error.code === "42P01"
            ? "CHAT_MIGRATION_REQUIRED"
            : "CHAT_PUSH_FAILED",
      },
      "Chat push worker failed.",
    );
  } finally {
    busy = false;
  }
}
export function startChatPushWorker() {
  if (timer || !enabled()) return;
  if (
    !process.env.CHAT_FCM_PROJECT_ID ||
    !process.env.CHAT_FCM_CREDENTIALS_FILE
  ) {
    logger.error("Chat push enabled without FCM configuration.");
    return;
  }
  timer = setInterval(processChatPush, 1000);
  timer.unref();
}
export function stopChatPushWorker() {
  clearInterval(timer);
  timer = null;
}
