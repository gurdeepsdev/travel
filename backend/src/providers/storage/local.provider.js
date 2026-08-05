import {
  constants as fileConstants,
} from "node:fs";
import StorageProvider from "./storage.interface.js";

import {
  copyFile,
  mkdir,
  rename,
  unlink,
} from "node:fs/promises";

import {
  dirname,
  resolve,
  sep,
} from "node:path";

import {
  randomUUID,
} from "node:crypto";

import storage from "../../config/storage.js";

const SAFE_PATH_SEGMENT =
  /^[A-Za-z0-9_-]+$/;

const SAFE_EXTENSION =
  /^[A-Za-z0-9]+$/;

function assertSafeSegment({
  name,
  value,
  pattern,
}) {
  if (
    typeof value !== "string" ||
    !pattern.test(value)
  ) {
    throw new Error(
      `${name} is not safe for a storage path.`,
    );
  }
}

function createStorageKey({
  userId,
  extension,
  now = new Date(),
}) {
  assertSafeSegment({
    name:
      "User ID",

    value:
      userId,

    pattern:
      SAFE_PATH_SEGMENT,
  });

  assertSafeSegment({
    name:
      "File extension",

    value:
      extension,

    pattern:
      SAFE_EXTENSION,
  });

  const year =
    String(
      now.getUTCFullYear(),
    );

  const month =
    String(
      now.getUTCMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  return [
    "posts",
    userId,
    year,
    month,
    `${randomUUID()}.${extension.toLowerCase()}`,
  ].join("/");
}

function resolveStoragePath(
  storageKey,
) {
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\")
  ) {
    throw new Error(
      "Storage key is invalid.",
    );
  }

  const segments =
    storageKey.split("/");

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new Error(
      "Storage key contains an unsafe path segment.",
    );
  }

  const targetPath =
    resolve(
      storage.local.root,
      ...segments,
    );

  const rootPrefix =
    `${storage.local.root}${sep}`;

  if (
    !targetPath.startsWith(
      rootPrefix,
    )
  ) {
    throw new Error(
      "Storage key resolves outside the upload directory.",
    );
  }

  return targetPath;
}

async function removeIfPresent(
  filePath,
) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      error?.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function moveAcrossFilesystems({
  sourcePath,
  destinationPath,
}) {
  await copyFile(
    sourcePath,
    destinationPath,
    fileConstants.COPYFILE_EXCL,
  );

  try {
    await unlink(
      sourcePath,
    );
  } catch (error) {
    await removeIfPresent(
      destinationPath,
    );

    throw error;
  }
}

class LocalStorageProvider 
  extends StorageProvider {
  get name() {
    return "local";
  }

  async store({
    temporaryPath,
    userId,
    extension,
  }) {
    const storageKey =
      createStorageKey({
        userId,
        extension,
      });

    const destinationPath =
      resolveStoragePath(
        storageKey,
      );

    await mkdir(
      dirname(
        destinationPath,
      ),
      {
        recursive: true,
      },
    );

    try {
      await rename(
        temporaryPath,
        destinationPath,
      );
    } catch (error) {
      if (
        error?.code !== "EXDEV"
      ) {
        throw error;
      }

      await moveAcrossFilesystems({
        sourcePath:
          temporaryPath,

        destinationPath,
      });
    }

    return {
      storageProvider:
        this.name,

      bucket:
        storage.local.bucket,

      storageKey,
    };
  }

  async remove({
    storageKey,
  }) {
    const storedPath =
      resolveStoragePath(
        storageKey,
      );

    await removeIfPresent(
      storedPath,
    );
  }
}

export {
  createStorageKey,
  resolveStoragePath,
};

export default new LocalStorageProvider();