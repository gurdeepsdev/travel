const VIDEO_PROCESSING_QUEUE =
  "media-video-processing";

const VIDEO_PROCESSING_JOB =
  "transcode-video";

const VIDEO_STORAGE_SYNC_JOB =
  "sync-video-storage";
const IMAGE_JOB = "optimize-post-image";
const IMAGE_PROCESSING_QUEUE = "media-post-images";

const VIDEO_PROCESSING_STATUS =
  Object.freeze({
    PROCESSING:
      "PROCESSING",

    READY:
      "READY",

    FAILED:
      "FAILED",
  });

export {
  IMAGE_JOB,
  IMAGE_PROCESSING_QUEUE,
  VIDEO_PROCESSING_JOB,
  VIDEO_PROCESSING_QUEUE,
  VIDEO_PROCESSING_STATUS,
  VIDEO_STORAGE_SYNC_JOB,
};
