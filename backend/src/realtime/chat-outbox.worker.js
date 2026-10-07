import Database from "../database/database-manager.js";
import Repository from "../modules/chat/chat.repository.js";
import logger from "../core/logger/logger.js";
import { emitUserEvent } from "./realtime-server.js";
import { enqueueChatPush } from "./chat-push.worker.js";
import { recordUserEventBatch } from "../modules/chat/chat-events.service.js";

let timer = null,
  processing = false;
export async function processChatEvents() {
  if (processing) return;
  processing = true;
  try {
    const deliveries = [];
    await Database.transaction(async (client) => {
      const {
        rows: [lock],
      } = await client.query(
        "SELECT pg_try_advisory_xact_lock(hashtextextended('chat-event-journal',0)) AS acquired",
      );
      if (!lock.acquired) return;
      const { rows } = await client.query(
        "SELECT * FROM chat.event_outbox WHERE processed_at IS NULL ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED",
      );
      for (const event of rows) {
        const recipients = await Repository.recipients(
          client,
          event.conversation_id,
        );
        const notifications = [];
        for (let start = 0; start < recipients.length; start += 500) {
          notifications.push(
            ...(await recordUserEventBatch(
              client,
              recipients.slice(start, start + 500).map((row) => row.user_id),
              event,
            )),
          );
        }
        await enqueueChatPush(client, event);
        deliveries.push({ event, notifications });
      }
      await client.query(
        "DELETE FROM chat.event_outbox WHERE id IN (SELECT id FROM chat.event_outbox WHERE processed_at<CURRENT_TIMESTAMP-INTERVAL '7 days' LIMIT 1000)",
      );
      await client.query(
        "DELETE FROM chat.user_events WHERE (user_id,sequence) IN (SELECT user_id,sequence FROM chat.user_events WHERE created_at<clock_timestamp()-INTERVAL '7 days' LIMIT 1000)",
      );
    });
    // Cursor rows must commit before a client receives and persists their cursor.
    for (const { event, notifications } of deliveries) {
      for (let start = 0; start < notifications.length; start += 500) {
        const batch = notifications.slice(start, start + 500);
        const recipients = await Database.transaction((client) =>
          Repository.recipients(
            client,
            event.conversation_id,
            batch.map((row) => row.userId),
          ),
        );
        const allowed = new Set(recipients.map((row) => row.user_id));
        for (const { userId, payload } of batch)
          if (allowed.has(userId))
            emitUserEvent(userId, "chat.updated", payload);
      }
      await Database.transaction((client) =>
        client.query(
          "UPDATE chat.event_outbox SET processed_at=CURRENT_TIMESTAMP WHERE id=$1",
          [event.id],
        ),
      );
    }
  } catch (error) {
    if (error.code !== "42P01")
      logger.error(
        { code: error.code ?? "CHAT_OUTBOX_FAILED" },
        "Chat outbox processing failed.",
      );
  } finally {
    processing = false;
  }
}
export function startChatOutboxWorker() {
  if (timer) return;
  timer = setInterval(processChatEvents, 500);
  timer.unref();
}
export function stopChatOutboxWorker() {
  clearInterval(timer);
  timer = null;
}
