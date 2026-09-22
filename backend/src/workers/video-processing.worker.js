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
} from "../modules/media/video-processing.constants.js";

import VideoProcessingRepository
  from "../modules/media/video-processing.repository.js";

import VideoProcessingService
  from "../modules/media/video-processing.service.js";
import VideoStorageSyncService
  from "../modules/media/video-storage-sync.service.js";

await connectInfrastructure();

const pendingAssets =
  await VideoProcessingRepository
    .findPendingAssets();

await enqueueVideoAssets(
  pendingAssets,
);

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
        VIDEO_STORAGE_SYNC_JOB &&
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
