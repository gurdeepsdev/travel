import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

import MemoriesMapper from "../mappers/memories.mapper.js";
import MemoriesRepository from "../repositories/memories.repository.js";

class MemoriesService {
  /**
   * Idempotently saves an owned image, video,
   * or boomerang asset as a private memory.
   */
  async saveMemory({
    userId,
    assetId,
    memoryType,
  }) {
    let memory;

    try {
      memory =
        await MemoriesRepository.save({
          userId,
          assetId,
          memoryType,
        });
    } catch (error) {
      /*
       * Covers an asset or user deleted concurrently
       * after the conditional eligibility query.
       */
      if (error.code === "23503") {
        throw this
          .createAssetNotAllowedError();
      }

      throw error;
    }

    /*
     * A null result hides all of these conditions:
     * - missing asset;
     * - another user's asset;
     * - soft-deleted asset;
     * - MIME/type mismatch.
     */
    if (!memory) {
      throw this
        .createAssetNotAllowedError();
    }

    return MemoriesMapper
      .toSaveResponse({
        memory,
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