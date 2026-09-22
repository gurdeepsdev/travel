import env from "./env.js";

const enabled =
  env.VIDEO_OBJECT_STORAGE_ENABLED ===
  "true";

const videoObjectStorage =
  Object.freeze({
    enabled,
    provider:
      env.VIDEO_OBJECT_STORAGE_PROVIDER,
    endpoint:
      env.VIDEO_OBJECT_STORAGE_ENDPOINT ??
      null,
    region:
      env.VIDEO_OBJECT_STORAGE_REGION,
    bucket:
      env.VIDEO_OBJECT_STORAGE_BUCKET ??
      null,
    accessKeyId:
      env.VIDEO_OBJECT_STORAGE_ACCESS_KEY_ID ??
      null,
    secretAccessKey:
      env.VIDEO_OBJECT_STORAGE_SECRET_ACCESS_KEY ??
      null,
    publicBaseUrl:
      env.VIDEO_CDN_PUBLIC_BASE_URL
        ?.replace(/\/+$/, "") ??
      null,
  });

export default videoObjectStorage;
