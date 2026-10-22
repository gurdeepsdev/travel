import { Queue } from "bullmq";
import Database from "../../database/database-manager.js";
import { connection } from "../media/video-processing.queue.js";
import { VIDEO_PROCESSING_QUEUE } from "../media/video-processing.constants.js";

export const CHAT_MEDIA_JOB = "optimize-private-chat-media";
const queue = new Queue(VIDEO_PROCESSING_QUEUE, { connection });
export async function enqueueChatMedia(assetId) {
  await queue.add(CHAT_MEDIA_JOB, { assetId }, {
    jobId: `chat-media-${assetId}`, attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  });
}
export async function recoverChatMedia() {
  const { rows } = await Database.query(`SELECT o.asset_id FROM chat.asset_optimizations o
    JOIN media.assets a ON a.id=o.asset_id
    WHERE o.status='PENDING' AND a.deleted_at IS NULL
      AND a.dedup_scope='chat_private' AND a.is_public IS FALSE
    ORDER BY o.updated_at LIMIT 100`);
  for (const row of rows) await enqueueChatMedia(row.asset_id);
}
