import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import CommentLikesMapper from "../mappers/comment-likes.mapper.js";
import CommentLikesRepository from "../repositories/comment-likes.repository.js";

import PostAccessService from "./post-access.service.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

class CommentLikesService {


    /**
 * Lists users who liked a comment.
 *
 * This endpoint is restricted to the owner of the
 * post containing the comment.
 */
async getCommentLikes({
  commentId,
  userId,
  limit = 20,
  cursor = null,
}) {
  /*
   * Check ownership before decoding or querying the
   * liker list. Unauthorized viewers receive the same
   * response as a missing comment.
   */
  const context =
    await CommentLikesRepository
      .findOwnerListContext({
        commentId,
        viewerUserId: userId,
      });

  if (!context) {
    throw this.createNotFoundError();
  }

  const decodedCursor =
    decodeCursor(cursor);

  const listResult =
    await CommentLikesRepository
      .listByComment({
        commentId,
        viewerUserId: userId,
        limit,
        cursor: decodedCursor,
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

  return CommentLikesMapper
    .toListResponse({
      commentId,

      /*
       * This is the trigger-maintained canonical count.
       * The visible list can contain fewer users if a
       * block relationship hides some accounts.
       */
      likeCount:
        context.like_count,

      rows:
        listResult.rows,

      hasMore:
        listResult.hasMore,

      nextCursor,
    });
}
  /**
   * Idempotently likes a comment.
   */
  async setLike({
    commentId,
    userId,
  }) {
    await this.assertCanInteract({
      commentId,
      userId,
    });

    try {
      await CommentLikesRepository.add({
        commentId,
        userId,
      });
    } catch (error) {
      /*
       * The comment may have been deleted between
       * authorization and insertion.
       */
      if (error.code === "23503") {
        throw this.createNotFoundError();
      }

      throw error;
    }

    return this.getCanonicalState({
      commentId,
      userId,
    });
  }

  /**
   * Idempotently removes the authenticated
   * user's comment like.
   */
  async removeLike({
    commentId,
    userId,
  }) {
    await this.assertCanInteract({
      commentId,
      userId,
    });

    await CommentLikesRepository.remove({
      commentId,
      userId,
    });

    return this.getCanonicalState({
      commentId,
      userId,
    });
  }

  /**
   * Ensures the comment exists, its post is
   * accessible, and neither user has blocked
   * the other.
   */
  async assertCanInteract({
    commentId,
    userId,
  }) {
    const comment =
      await CommentLikesRepository
        .findCommentContext({
          commentId,
          viewerUserId: userId,
        });

    if (
      !comment ||
      comment.has_block_relationship
    ) {
      throw this.createNotFoundError();
    }

    await PostAccessService.assertCanInteract({
      postId: comment.post_id,
      userId,
    });

    return comment;
  }

  /**
   * Reads the trigger-updated like count and
   * the viewer's canonical like state.
   */
  async getCanonicalState({
    commentId,
    userId,
  }) {
    const state =
      await CommentLikesRepository.getState({
        commentId,
        userId,
      });

    if (!state) {
      throw this.createNotFoundError();
    }

    return CommentLikesMapper.toResponse({
      commentId,
      state,
    });
  }

  createNotFoundError() {
    return new AppError({
      code: ErrorCodes.COMMENT.NOT_FOUND,
      message: "Comment not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export default new CommentLikesService();