import Database from "../database/database-manager.js";
import logger from "../core/logger/logger.js";
import PostEngagementRepository from "../modules/posts/repositories/post-engagement.repository.js";
import { POST_REACTION_VALUES } from "../modules/posts/post-reactions.constants.js";
import { emitPostEngagement } from "./realtime-server.js";

const POLL_INTERVAL_MS = 250;
const BATCH_SIZE = 100;
let timer = null;
let processing = false;

async function processBatch() {
  if (processing) {
    return;
  }
  processing = true;

  try {
    await Database.transaction(async (client) => {
      const lockResult = await client.query(
        "SELECT pg_try_advisory_xact_lock(7046029254386353131) AS acquired",
      );
      if (lockResult.rows[0]?.acquired !== true) {
        return;
      }

      const { rows } = await client.query(`
        SELECT id, post_id, event_type, comment_id, created_at
        FROM infrastructure.engagement_outbox
        WHERE processed_at IS NULL
        ORDER BY id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `, [BATCH_SIZE]);

      const latestEvents = new Map();
      for (const event of rows) {
        const key = [
          event.post_id,
          event.event_type,
          event.comment_id ?? "",
        ].join(":");
        latestEvents.set(key, event);
      }

      const eventsToEmit = [...latestEvents.values()]
        .sort((left, right) => Number(left.id) - Number(right.id));

      for (const event of eventsToEmit) {
        const state = await PostEngagementRepository.getPublicState(
          event.post_id,
          client,
        );

        if (state) {
          let comment = null;
          if (event.comment_id) {
            const commentResult = await client.query(`
              SELECT id, like_count
              FROM explore.comments
              WHERE id = $1::uuid
            `, [event.comment_id]);
            const row = commentResult.rows[0];
            comment = row
              ? { id: row.id, likeCount: Number(row.like_count ?? 0) }
              : { id: event.comment_id, deleted: true };
          }

          emitPostEngagement(event.post_id, {
            eventId: String(event.id),
            type: event.event_type,
            postId: event.post_id,
            version: Number(event.id),
            engagement: {
              reactions: Number(state.reaction_count ?? 0),
              reactionSummary: Object.fromEntries(
                POST_REACTION_VALUES.map((type) => [
                  type,
                  Number(state.reaction_summary?.[type] ?? 0),
                ]),
              ),
              comments: Number(state.comment_count ?? 0),
              beenThere: Number(state.been_there_count ?? 0),
            },
            comment,
            occurredAt: event.created_at,
          });
        }

      }

      if (rows.length > 0) {
        await client.query(`
          UPDATE infrastructure.engagement_outbox
          SET processed_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1::bigint[])
        `, [rows.map((event) => event.id)]);

        await client.query(`
          DELETE FROM infrastructure.engagement_outbox
          WHERE id IN (
            SELECT id
            FROM infrastructure.engagement_outbox
            WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
            ORDER BY id
            LIMIT 1000
          )
        `);
      }
    });
  } catch (error) {
    if (error.code !== "42P01") {
      logger.error({ error }, "Engagement outbox processing failed.");
    }
  } finally {
    processing = false;
  }
}

function startEngagementOutboxWorker() {
  if (timer) {
    return;
  }
  timer = setInterval(processBatch, POLL_INTERVAL_MS);
  timer.unref();
  void processBatch();
  logger.info("Engagement outbox worker started.");
}

function stopEngagementOutboxWorker() {
  if (timer) {
    clearInterval(timer);
  }
  timer = null;
}

export {
  processBatch,
  startEngagementOutboxWorker,
  stopEngagementOutboxWorker,
};
