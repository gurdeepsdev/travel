import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import CommentLikesMapper from "../mappers/comment-likes.mapper.js";
import CommentLikesRepository from "../repositories/comment-likes.repository.js";

import PostAccessService from "./post-access.service.js";

class CommentLikesService {
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