import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

import BlocksMapper
  from "../mappers/blocks.mapper.js";

import BlocksRepository
  from "../repositories/blocks.repository.js";

class BlocksService {
  async blockUser({
    userId,
    blockedUserId,
  }) {
    if (
      userId ===
      blockedUserId
    ) {
      throw this
        .createSelfBlockError();
    }

    const row =
      await BlocksRepository
        .blockUser({
          userId,
          blockedUserId,
        });

    if (!row) {
      throw this
        .createTargetNotAvailableError();
    }

    return BlocksMapper
      .toBlockResponse(
        row,
      );
  }

  async unblockUser({
    userId,
    blockedUserId,
  }) {
    if (
      userId ===
      blockedUserId
    ) {
      throw this
        .createSelfBlockError();
    }

    const row =
      await BlocksRepository
        .unblockUser({
          userId,
          blockedUserId,
        });

    return BlocksMapper
      .toUnblockResponse({
        row,
        blockedUserId,
      });
  }

  async getBlockedUsers({
    userId,
    limit,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(
        cursor,
      );

    const result =
      await BlocksRepository
        .listBlockedUsers({
          userId,
          limit,
          cursor:
            decodedCursor,
        });

    const nextCursor =
      result.hasMore &&
      result.lastRow
        ? encodeCursor({
            createdAt:
              result.lastRow
                .cursor_created_at ??
              result.lastRow
                .created_at,

            id:
              result.lastRow.id,
          })
        : null;

    return BlocksMapper
      .toListResponse({
        rows:
          result.rows,

        hasMore:
          result.hasMore,

        nextCursor,
      });
  }

  createSelfBlockError() {
    return new AppError({
      code:
        ErrorCodes.BLOCK
          .SELF_BLOCK_NOT_ALLOWED,

      message:
        "You cannot block yourself.",

      statusCode:
        HttpStatus.BAD_REQUEST,
    });
  }

  createTargetNotAvailableError() {
    return new AppError({
      code:
        ErrorCodes.BLOCK
          .TARGET_NOT_AVAILABLE,

      message:
        "The requested user was not found or is not available.",

      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }
}

export default new BlocksService();
