import {
  Queue,
} from "bullmq";

import {
  createHash,
} from "node:crypto";

import env from "../../config/env.js";

import {
  VIDEO_PROCESSING_JOB,
  VIDEO_PROCESSING_QUEUE,
  VIDEO_PROCESSING_STATUS,
  VIDEO_STORAGE_SYNC_JOB,
  IMAGE_JOB,
  IMAGE_PROCESSING_QUEUE,
} from "./video-processing.constants.js";

const connection = {
  host:
    env.REDIS_HOST,

  port:
    env.REDIS_PORT,

  maxRetriesPerRequest:
    null,
};

const queue =
  new Queue(
    VIDEO_PROCESSING_QUEUE,
    {
      connection,

      defaultJobOptions: {
        attempts:
          3,

        backoff: {
          type:
            "exponential",

          delay:
            5000,
        },

        removeOnComplete: {
          age:
            24 * 60 * 60,

          count:
            1000,
        },

        removeOnFail: {
          age:
            7 * 24 * 60 * 60,

          count:
            5000,
        },
      },
    },
  );

const imageQueue = new Queue(IMAGE_PROCESSING_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3, backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});

function createVideoProcessingJobs(
  assets,
) {
  return (assets ?? [])
    .filter(
      (asset) =>
        asset?.id &&
        String(
          asset.mime_type ?? "",
        ).startsWith(
          "video/",
        ) &&
        asset.processing_status ===
          VIDEO_PROCESSING_STATUS
            .PROCESSING,
    )
    .map((asset) => {
      const storageVersion =
        createHash("sha256")
          .update(
            String(
              asset.storage_key ??
                asset.id,
            ),
          )
          .digest("hex")
          .slice(
            0,
            16,
          );

      return {
        name:
          VIDEO_PROCESSING_JOB,

        data: {
          assetId:
            asset.id,
        },

        opts: {
          jobId:
            `video-${asset.id}-${storageVersion}`,
        },
      };
    });
}

async function enqueueVideoAssets(
  assets,
) {
  const jobs = createVideoProcessingJobs(assets);

  if (jobs.length > 0) {
    await queue.addBulk(
      jobs,
    );
  }
  const imageJobs = createImageProcessingJobs(assets);
  if (imageJobs.length) await imageQueue.addBulk(imageJobs);
}

async function enqueueVideoStorageSync(
  assets,
) {
  const jobs = (assets ?? [])
    .filter((asset) =>
      asset?.id &&
      String(
        asset.mime_type ?? "",
      ).startsWith("video/") &&
      asset.processing_status ===
        VIDEO_PROCESSING_STATUS.READY,
    )
    .map((asset) => ({
      name:
        VIDEO_STORAGE_SYNC_JOB,
      data: {
        assetId:
          asset.id,
      },
    }));

  if (jobs.length > 0) await queue.addBulk(jobs);
  const imageJobs = createImageProcessingJobs(assets, false);
  if (imageJobs.length) await imageQueue.addBulk(imageJobs);
}

function createImageProcessingJobs(assets, deduplicate = true) {
  return (assets ?? []).filter((asset) => asset?.id && String(asset.mime_type ?? '').startsWith('image/') &&
    asset.processing_status === 'READY').map((asset) => ({
    name: IMAGE_JOB, data: { assetId: asset.id },
    ...(deduplicate ? { opts: { jobId: `image-${asset.id}-${createHash('sha256').update(String(asset.storage_key ?? asset.id)).digest('hex').slice(0, 16)}` } } : {}),
  }));
}

export {
  connection,
  createVideoProcessingJobs,
  createImageProcessingJobs,
  enqueueVideoAssets,
  enqueueVideoStorageSync,
  queue,
};
