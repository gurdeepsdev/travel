import {
  spawn,
} from "node:child_process";

import {
  rename,
  stat,
  unlink,
} from "node:fs/promises";

import {
  extname,
} from "node:path";

import {
  randomUUID,
} from "node:crypto";

import {
  resolveStoragePath,
} from "../../providers/storage/local.provider.js";

const PROCESS_TIMEOUT_MS =
  30 * 60 * 1000;

function runProcess({
  command,
  args,
  timeoutMs =
    PROCESS_TIMEOUT_MS,
}) {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const child =
        spawn(
          command,
          args,
          {
            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
          },
        );

      let stdout = "";
      let stderr = "";

      const timer =
        setTimeout(
          () => {
            child.kill(
              "SIGKILL",
            );
          },
          timeoutMs,
        );

      child.stdout.on(
        "data",
        (chunk) => {
          stdout += chunk;
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          stderr = (
            stderr + chunk
          ).slice(
            -16000,
          );
        },
      );

      child.once(
        "error",
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );

      child.once(
        "close",
        (code, signal) => {
          clearTimeout(timer);

          if (code === 0) {
            resolve({
              stdout,
              stderr,
            });

            return;
          }

          reject(
            new Error(
              `${command} failed (${signal ?? code}): ${stderr}`,
            ),
          );
        },
      );
    },
  );
}

function createFfmpegArguments({
  inputPath,
  outputPath,
}) {
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale='trunc(min(1920,iw)/2)*2':-2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-metadata:s:v:0",
    "rotate=0",
    "-f",
    "mp4",
    outputPath,
  ];
}

function createThumbnailArguments({
  inputPath,
  outputPath,
  durationSeconds,
}) {
  const seekSeconds =
    Math.max(
      0,
      Math.min(
        5,
        Number(durationSeconds) *
          0.1,
      ),
    );

  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-ss",
    seekSeconds.toFixed(3),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(640,iw)':-2",
    "-q:v",
    "3",
    "-f",
    "image2",
    outputPath,
  ];
}

async function probeVideo(
  filePath,
) {
  const { stdout } =
    await runProcess({
      command:
        "ffprobe",

      args: [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height:format=duration",
        "-of",
        "json",
        filePath,
      ],

      timeoutMs:
        60 * 1000,
    });

  const parsed =
    JSON.parse(stdout);

  const stream =
    parsed.streams?.[0];

  const width =
    Number(stream?.width);

  const height =
    Number(stream?.height);

  const duration =
    Number(
      parsed.format?.duration,
    );

  if (
    stream?.codec_name !== "h264" ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0 ||
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    throw new Error(
      "Transcoded video failed output validation.",
    );
  }

  return {
    width,
    height,

    durationSeconds:
      Math.ceil(duration),
  };
}

async function probeImage(
  filePath,
) {
  const { stdout } =
    await runProcess({
      command:
        "ffprobe",

      args: [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        filePath,
      ],

      timeoutMs:
        60 * 1000,
    });

  const stream =
    JSON.parse(stdout)
      .streams?.[0];

  const width =
    Number(stream?.width);

  const height =
    Number(stream?.height);

  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error(
      "Generated thumbnail failed output validation.",
    );
  }

  return {
    width,
    height,
  };
}

async function removeIfPresent(
  filePath,
) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function createMp4StorageKey(
  storageKey,
) {
  const extension =
    extname(storageKey);

  return extension
    ? `${storageKey.slice(
        0,
        -extension.length,
      )}.mp4`
    : `${storageKey}.mp4`;
}

function createThumbnailStorageKey(
  storageKey,
) {
  const extension =
    extname(storageKey);

  const baseKey =
    extension
      ? storageKey.slice(
          0,
          -extension.length,
        )
      : storageKey;

  return `${baseKey}.thumbnail.jpg`;
}

async function transcodeLocalVideo({
  assetId,
  storageKey,
}) {
  const inputPath =
    resolveStoragePath(
      storageKey,
    );

  const outputStorageKey =
    createMp4StorageKey(
      storageKey,
    );

  const outputPath =
    resolveStoragePath(
      outputStorageKey,
    );

  const temporaryOutputPath =
    `${outputPath}.${assetId}.${randomUUID()}.processing`;

  const backupPath =
    `${inputPath}.${assetId}.${randomUUID()}.original`;

  const thumbnailStorageKey =
    createThumbnailStorageKey(
      outputStorageKey,
    );

  const thumbnailPath =
    resolveStoragePath(
      thumbnailStorageKey,
    );

  const temporaryThumbnailPath =
    `${thumbnailPath}.${assetId}.${randomUUID()}.processing`;

  try {
    await runProcess({
      command:
        "ffmpeg",

      args:
        createFfmpegArguments({
          inputPath,
          outputPath:
            temporaryOutputPath,
        }),
    });

    const metadata =
      await probeVideo(
        temporaryOutputPath,
      );

    const outputStats =
      await stat(
        temporaryOutputPath,
      );

    await runProcess({
      command:
        "ffmpeg",

      args:
        createThumbnailArguments({
          inputPath:
            temporaryOutputPath,

          outputPath:
            temporaryThumbnailPath,

          durationSeconds:
            metadata.durationSeconds,
        }),
    });

    const thumbnailMetadata =
      await probeImage(
        temporaryThumbnailPath,
      );

    const thumbnailStats =
      await stat(
        temporaryThumbnailPath,
      );

    if (outputPath === inputPath) {
      await rename(
        inputPath,
        backupPath,
      );
    }

    try {
      await rename(
        temporaryOutputPath,
        outputPath,
      );
    } catch (error) {
      if (outputPath === inputPath) {
        await rename(
          backupPath,
          inputPath,
        );
      }

      throw error;
    }

    try {
      await rename(
        temporaryThumbnailPath,
        thumbnailPath,
      );
    } catch (error) {
      await removeIfPresent(
        outputPath,
      );

      if (outputPath === inputPath) {
        await rename(
          backupPath,
          inputPath,
        );
      }

      throw error;
    }

    return {
      outputPath,
      outputStorageKey,
      sourcePath:
        inputPath,
      backupPath:
        outputPath === inputPath
          ? backupPath
          : null,
      fileSize:
        outputStats.size,

      thumbnailPath,
      thumbnailStorageKey,

      thumbnailFileSize:
        thumbnailStats.size,

      thumbnailWidth:
        thumbnailMetadata.width,

      thumbnailHeight:
        thumbnailMetadata.height,
      ...metadata,
    };
  } catch (error) {
    await removeIfPresent(
      temporaryOutputPath,
    );

    await removeIfPresent(
      temporaryThumbnailPath,
    );

    throw error;
  }
}

async function finalizeTranscode({
  sourcePath,
  outputPath,
  backupPath,
}) {
  if (backupPath) {
    await removeIfPresent(
      backupPath,
    );

    return;
  }

  if (sourcePath !== outputPath) {
    await removeIfPresent(
      sourcePath,
    );
  }
}

async function rollbackTranscode({
  sourcePath,
  outputPath,
  backupPath,
  thumbnailPath,
}) {
  await removeIfPresent(
    outputPath,
  );

  await removeIfPresent(
    thumbnailPath,
  );

  if (backupPath) {
    await rename(
      backupPath,
      sourcePath,
    );
  }
}

export {
  createFfmpegArguments,
  createMp4StorageKey,
  createThumbnailArguments,
  createThumbnailStorageKey,
  finalizeTranscode,
  probeVideo,
  rollbackTranscode,
  runProcess,
  transcodeLocalVideo,
};
