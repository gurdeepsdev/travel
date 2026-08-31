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
  const jobs =
    createVideoProcessingJobs(
      assets,
    );

  if (jobs.length > 0) {
    await queue.addBulk(
      jobs,
    );
  }
}

export {
  connection,
  createVideoProcessingJobs,
  enqueueVideoAssets,
  queue,
};
