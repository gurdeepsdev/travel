import {
  Worker,
} from "bullmq";

import {
  connectInfrastructure,
} from "../config/database.js";

import logger from "../core/logger/logger.js";

import {
  connection,
  enqueueVideoAssets,
  enqueueVideoStorageSync,
} from "../modules/media/video-processing.queue.js";

import {
  VIDEO_PROCESSING_QUEUE,
  VIDEO_STORAGE_SYNC_JOB,
  IMAGE_PROCESSING_QUEUE,
} from "../modules/media/video-processing.constants.js";

import VideoProcessingRepository
  from "../modules/media/video-processing.repository.js";

import VideoProcessingService
  from "../modules/media/video-processing.service.js";
import VideoStorageSyncService
  from "../modules/media/video-storage-sync.service.js";
import ImageProcessingService, { findImageCandidates }
  from "../modules/media/image-processing.service.js";
import ChatMediaProcessor, { markChatMediaFailed } from "../modules/chat/chat-media.processor.js";
import { CHAT_MEDIA_JOB, recoverChatMedia } from "../modules/chat/chat-media.queue.js";

await connectInfrastructure();
await recoverChatMedia();
const chatRecovery = setInterval(() => {
  recoverChatMedia().catch(error => logger.error({ error: { name: error.name } }, "Chat media recovery failed."));
}, 60000);
chatRecovery.unref();

const pendingAssets =
  await VideoProcessingRepository
    .findPendingAssets();

await enqueueVideoAssets(
  pendingAssets,
);
await enqueueVideoStorageSync(await findImageCandidates());

const storageSyncCandidates =
  await VideoProcessingRepository
    .findStorageSyncCandidates();

await enqueueVideoStorageSync(
  storageSyncCandidates,
);

const worker =
  new Worker(
    VIDEO_PROCESSING_QUEUE,
    async (job) => {
      if (job.name === CHAT_MEDIA_JOB) return ChatMediaProcessor.process(job.data.assetId);
      if (
        job.name ===
          VIDEO_STORAGE_SYNC_JOB
      ) {
        return VideoStorageSyncService
          .sync(
            job.data.assetId,
          );
      }

      return VideoProcessingService
        .process(
          job.data.assetId,
        );
    },
    {
      connection,
      concurrency:
        1,
    },
  );

worker.on(
  "completed",
  (job) => {
    logger.info(
      {
        jobId:
          job.id,

        jobName:
          job.name,

        assetId:
          job.data.assetId,
      },
      "Video worker job completed.",
    );
  },
);

worker.on(
  "failed",
  async (
    job,
    error,
  ) => {
    logger.error(
      {
        jobId:
          job?.id,

        assetId:
          job?.data?.assetId,

        attemptsMade:
          job?.attemptsMade,

        error: {
          name:
            error.name,

          message:
            error.message,

          stack:
            error.stack,
        },
      },
      "Video worker job failed.",
    );

    if (
      job &&
      job.name !==
        VIDEO_STORAGE_SYNC_JOB && job.name !== CHAT_MEDIA_JOB &&
      job.attemptsMade >=
        (job.opts.attempts ?? 1)
    ) {
      await VideoProcessingRepository
        .markFailed({
          assetId:
            job.data.assetId,

          errorMessage:
            error.message,
        });
    }
    if (job?.name === CHAT_MEDIA_JOB && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await markChatMediaFailed(job.data.assetId);
    }
  },
);

async function shutdown(
  signal,
) {
  logger.info(
    {
      signal,
    },
    "Stopping video processing worker.",
  );

  await worker.close();
  clearInterval(chatRecovery);
  await imageWorker.close();
  process.exit(0);
}

process.once(
  "SIGTERM",
  () => {
    void shutdown(
      "SIGTERM",
    );
  },
);

process.once(
  "SIGINT",
  () => {
    void shutdown(
      "SIGINT",
    );
  },
);

logger.info(
  "Video processing worker started.",
);

const imageWorker = new Worker(IMAGE_PROCESSING_QUEUE,
  (job) => ImageProcessingService.process(job.data.assetId), { connection, concurrency: 1 });
imageWorker.on('completed', (job) => logger.info({ assetId: job.data.assetId }, 'Image optimization completed.'));
imageWorker.on('failed', (job, error) => logger.error({ assetId: job?.data?.assetId,
  attemptsMade: job?.attemptsMade, error: { name: error.name, message: error.message } }, 'Image optimization failed; original retained.'));
logger.info('Post image worker started.');
