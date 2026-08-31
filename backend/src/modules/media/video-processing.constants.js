const VIDEO_PROCESSING_QUEUE =
  "media-video-processing";

const VIDEO_PROCESSING_JOB =
  "transcode-video";

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
  VIDEO_PROCESSING_JOB,
  VIDEO_PROCESSING_QUEUE,
  VIDEO_PROCESSING_STATUS,
};
