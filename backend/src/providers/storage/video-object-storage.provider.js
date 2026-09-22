import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  createReadStream,
} from "node:fs";

import {
  readdir,
} from "node:fs/promises";

import {
  join,
  relative,
} from "node:path";

import videoObjectStorage
  from "../../config/video-object-storage.js";

const CONTENT_TYPES =
  Object.freeze({
    ".jpg": "image/jpeg",
    ".m3u8":
      "application/vnd.apple.mpegurl",
    ".mp4": "video/mp4",
    ".ts": "video/mp2t",
  });

function contentTypeFor(
  storageKey,
) {
  const extension =
    Object.keys(CONTENT_TYPES)
      .find((candidate) =>
        storageKey.endsWith(candidate),
      );

  return CONTENT_TYPES[extension] ??
    "application/octet-stream";
}

function cacheControlFor(
  storageKey,
) {
  return storageKey.endsWith(".m3u8")
    ? "public, max-age=60"
    : "public, max-age=31536000, immutable";
}

async function listFiles(
  directory,
) {
  const entries = await readdir(
    directory,
    {
      recursive: true,
      withFileTypes: true,
    },
  );

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(
        entry.parentPath,
        entry.name,
      ),
    );
}

class VideoObjectStorageProvider {
  constructor() {
    this.client = null;
  }

  get enabled() {
    return videoObjectStorage.enabled;
  }

  get name() {
    return videoObjectStorage.provider;
  }

  get bucket() {
    return videoObjectStorage.bucket;
  }

  getClient() {
    if (!this.enabled) {
      throw new Error(
        "Video object storage is disabled.",
      );
    }

    if (!this.client) {
      const credentials =
        videoObjectStorage.accessKeyId &&
        videoObjectStorage.secretAccessKey
          ? {
              accessKeyId:
                videoObjectStorage.accessKeyId,
              secretAccessKey:
                videoObjectStorage.secretAccessKey,
            }
          : undefined;

      this.client = new S3Client({
        endpoint:
          videoObjectStorage.endpoint ??
          undefined,
        region:
          videoObjectStorage.region,
        forcePathStyle: false,
        credentials,
      });
    }

    return this.client;
  }

  async uploadFile({
    filePath,
    storageKey,
  }) {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: createReadStream(filePath),
        ContentType:
          contentTypeFor(storageKey),
        CacheControl:
          cacheControlFor(storageKey),
      }),
    );

    return storageKey;
  }

  async listTranscodeObjects({
    outputPath,
    outputStorageKey,
    thumbnailPath,
    thumbnailStorageKey,
    hlsDirectory,
    hlsManifestStorageKey,
  }) {
    const hlsPrefix =
      hlsManifestStorageKey.slice(
        0,
        -"master.m3u8".length,
      );

    const hlsFiles =
      await listFiles(hlsDirectory);

    return [
      {
        filePath: outputPath,
        storageKey: outputStorageKey,
      },
      {
        filePath: thumbnailPath,
        storageKey: thumbnailStorageKey,
      },
      ...hlsFiles.map((filePath) => ({
        filePath,
        storageKey:
          `${hlsPrefix}${relative(
            hlsDirectory,
            filePath,
          ).replaceAll("\\", "/")}`,
      })),
    ];
  }

  async publishTranscode(
    transcode,
  ) {
    const objects =
      await this.listTranscodeObjects(
        transcode,
      );

    const uploadedKeys = [];

    try {
      const concurrency = 8;

      for (
        let index = 0;
        index < objects.length;
        index += concurrency
      ) {
        const batch = objects.slice(
          index,
          index + concurrency,
        );

        const results =
          await Promise.allSettled(
            batch.map(async (object) => {
              await this.uploadFile(object);
              uploadedKeys.push(
                object.storageKey,
              );
            }),
          );

        const failure = results.find(
          (result) =>
            result.status ===
            "rejected",
        );

        if (failure) {
          throw failure.reason;
        }
      }
    } catch (error) {
      await Promise.allSettled([
        this.removeMany(uploadedKeys),
      ]);
      throw error;
    }

    return {
      storageProvider: this.name,
      bucket: this.bucket,
      uploadedKeys,
    };
  }

  async removeTranscode(
    transcode,
  ) {
    const objects =
      await this.listTranscodeObjects(
        transcode,
      );

    await this.removeMany(
      objects.map(
        (object) =>
          object.storageKey,
      ),
    );
  }

  async removeMany(storageKeys) {
    if (!storageKeys?.length) {
      return;
    }

    await this.getClient().send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Quiet: true,
          Objects: storageKeys.map(
            (Key) => ({ Key }),
          ),
        },
      }),
    );
  }
}

export default new VideoObjectStorageProvider();
