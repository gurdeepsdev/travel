import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import Database from "../../../database/database-manager.js";
import StorageManager from "../../../providers/storage/storage-manager.js";
import MediaRepository from "../../media/media.repository.js";

import {
  inspectMemoryMediaFile,
} from "../utils/memory-media-file.util.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

import MemoriesMapper from "../mappers/memories.mapper.js";
import MemoriesRepository from "../repositories/memories.repository.js";


async function cleanupStoredObjects({
  objects,
  logger,
}) {
  const storageKeys =
    new Set();

  const uniqueObjects =
    (objects ?? [])
      .filter((object) => {
        const storageKey =
          object?.storageKey;

        if (
          !storageKey ||
          storageKeys.has(
            storageKey,
          )
        ) {
          return false;
        }

        storageKeys.add(
          storageKey,
        );

        return true;
      });

  const results =
    await Promise.allSettled(
      uniqueObjects.map(
        (object) =>
          StorageManager.remove({
            storageKey:
              object.storageKey,
          }),
      ),
    );

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
        "rejected"
      ) {
        logger?.error(
          {
            storageKey:
              uniqueObjects[index]
                .storageKey,

            error:
              result.reason,
          },
          "Failed to clean memory media.",
        );
      }
    },
  );
}

function createMemoryInputError({
  code,
  message,
}) {
  return new AppError({
    code,
    message,

    statusCode:
      HttpStatus.BAD_REQUEST,

    details: null,
  });
}




class MemoriesService {
  /**
   * Idempotently saves an owned image, video,
   * or boomerang asset as a private memory.
   */
    async saveMemory({
    userId,
    assetId = null,
    memoryType,
    memoryFile = null,
    logger = null,
  }) {
    const hasAssetId =
      Boolean(
        assetId,
      );

    const hasUpload =
      Boolean(
        memoryFile,
      );

    if (
      !hasAssetId &&
      !hasUpload
    ) {
      throw createMemoryInputError({
        code:
          ErrorCodes.MEMORY
            .MEDIA_REQUIRED,

        message:
          "An existing asset ID or memory media file is required.",
      });
    }

    if (
      hasAssetId &&
      hasUpload
    ) {
      throw createMemoryInputError({
        code:
          ErrorCodes.COMMON
            .VALIDATION_FAILED,

        message:
          "Provide either assetId or memoryFile, not both.",
      });
    }

    if (hasAssetId) {
      let memory;

      try {
        memory =
          await MemoriesRepository
            .save({
              userId,
              assetId,
              memoryType,
            });
      } catch (error) {
        if (
          error.code ===
          "23503"
        ) {
          throw this
            .createAssetNotAllowedError();
        }

        throw error;
      }

      if (!memory) {
        throw this
          .createAssetNotAllowedError();
      }

      return MemoriesMapper
        .toSaveResponse({
          memory,
        });
    }

    let inspectedFile;

    try {
      inspectedFile =
        await inspectMemoryMediaFile(
          memoryFile,
        );
    } catch (error) {
      if (
        error instanceof
          AppError
      ) {
        throw error;
      }

      throw new AppError({
        code:
          ErrorCodes.MEMORY
            .MEDIA_UPLOAD_FAILED,

        message:
          "Memory media could not be inspected.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    const expectedMediaType =
      memoryType === "IMAGE"
        ? "IMAGE"
        : "VIDEO";

    if (
      inspectedFile.mediaType !==
      expectedMediaType
    ) {
      throw new AppError({
        code:
          ErrorCodes.MEMORY
            .MEDIA_INVALID_TYPE,

        message:
          "Memory type does not match the uploaded media.",

        statusCode:
          HttpStatus
            .UNSUPPORTED_MEDIA_TYPE,

        details: {
          memoryType,

          detectedMediaType:
            inspectedFile.mediaType,
        },
      });
    }

    let storedUpload;

    try {
      const stored =
        await StorageManager.store({
          temporaryPath:
            inspectedFile
              .temporaryPath,

          category:
            "memories",

          userId,

          extension:
            inspectedFile
              .extension,
        });

      storedUpload = {
        ...inspectedFile,
        ...stored,
        fileIndex: 0,
      };
    } catch (error) {
      throw new AppError({
        code:
          ErrorCodes.MEMORY
            .MEDIA_UPLOAD_FAILED,

        message:
          "Memory media could not be stored.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    let transactionResult;

    try {
      transactionResult =
        await Database.transaction(
          async (client) => {
            const uploadedResolution =
              await MediaRepository
                .resolveUploadedAssets({
                  client,
                  userId,

                  isPublic:
                    false,

                  uploads: [
                    storedUpload,
                  ],
                });

            const uploadedAsset =
              uploadedResolution
                .assets[0];

            if (!uploadedAsset) {
              throw this
                .createAssetNotAllowedError();
            }

            const memory =
              await MemoriesRepository
                .save({
                  client,
                  userId,

                  assetId:
                    uploadedAsset.id,

                  memoryType,
                });

            if (!memory) {
              throw this
                .createAssetNotAllowedError();
            }

            return {
              memory,

              unusedStoredObjects:
                uploadedResolution
                  .unusedStoredObjects,

              supersededStoredObjects:
                uploadedResolution
                  .supersededStoredObjects,
            };
          },
        );
    } catch (error) {
      await cleanupStoredObjects({
        objects: [
          storedUpload,
        ],

        logger,
      });

      if (
        error instanceof
          AppError
      ) {
        throw error;
      }

      throw new AppError({
        code:
          ErrorCodes.MEMORY
            .MEDIA_UPLOAD_FAILED,

        message:
          "Memory media could not be saved.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: null,

        cause:
          error,
      });
    }

    await cleanupStoredObjects({
      objects: [
        ...transactionResult
          .unusedStoredObjects,

        ...transactionResult
          .supersededStoredObjects,
      ],

      logger,
    });

    return MemoriesMapper
      .toSaveResponse({
        memory:
          transactionResult.memory,
      });
  }

  /**
   * Returns the authenticated user's memories
   * using stable keyset pagination.
   */
  async getMyMemories({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await MemoriesRepository
        .listMine({
          userId,
          limit,
          cursor:
            decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_created_at ??
              listResult.lastRow
                .created_at,

            id:
              listResult.lastRow.id,
          })
        : null;

    return MemoriesMapper
      .toListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }

  createAssetNotAllowedError() {
    return new AppError({
      code:
        ErrorCodes.MEMORY
          .ASSET_NOT_ALLOWED,

      message:
        "Memory asset was not found or is not allowed.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }
}

export default new MemoriesService();