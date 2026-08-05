import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import PostCommentsMapper from "../mappers/post-comments.mapper.js";
import PostCommentsRepository from "../repositories/post-comments.repository.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";
import PostAccessService from "./post-access.service.js";

class PostCommentsService {

  async getPostComments({
    postId,
    viewerUserId = null,
    limit = 20,
    cursor = null,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId: viewerUserId,
    });

    const decodedCursor =
      decodeCursor(cursor);

    const [
      listResult,
      commentCount,
    ] = await Promise.all([
      PostCommentsRepository
        .listTopLevelByPost({
          postId,
          viewerUserId,
          limit,
          cursor: decodedCursor,
        }),

      PostCommentsRepository
        .countByPostId(postId),
    ]);

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

    return PostCommentsMapper
      .toListResponse({
        postId,
        rows: listResult.rows,
        commentCount,
        hasMore: listResult.hasMore,
        nextCursor,
      });
  }


  async createComment({
    postId,
    userId,
    comment,
    parentCommentId = null,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    let createdComment;

    try {
      createdComment =
        await PostCommentsRepository.create({
          postId,
          userId,
          comment,
          parentCommentId,
        });
    } catch (error) {
      if (error.code === "23503") {
        await this.handleForeignKeyRace({
          postId,
          userId,
          parentCommentId,
        });
      }

      throw error;
    }

    /*
     * The conditional INSERT returns no row when the
     * requested parent does not belong to this post.
     */
    if (!createdComment) {
      if (parentCommentId) {
        throw this.createParentNotFoundError();
      }

      throw this.createCommentFailedError();
    }

    const commentCount =
      await PostCommentsRepository
        .countByPostId(postId);

    return PostCommentsMapper.toCreateResponse({
      comment: createdComment,
      commentCount,
    });
  }



async deleteComment({
  commentId,
  userId,
}) {
  /*
   * Authorization and deletion happen in one SQL
   * statement. Only the comment author or the post
   * owner can delete the comment.
   */
  const deletedComment =
    await PostCommentsRepository
      .deleteAuthorized({
        commentId,
        userId,
      });

  /*
   * This also hides comments that exist but are not
   * owned by the viewer or written on their post.
   */
  if (!deletedComment) {
    throw this.createNotFoundError();
  }

  /*
   * PostgreSQL may cascade-delete replies. Reading the
   * count afterward returns the trigger-updated total.
   */
  const commentCount =
    await PostCommentsRepository
      .countByPostId(
        deletedComment.post_id,
      );

  return PostCommentsMapper
    .toDeleteResponse({
      deletedComment,
      commentCount,
    });
}

  async handleForeignKeyRace({
    postId,
    userId,
    parentCommentId,
  }) {
    /*
     * Recheck post access first. If the post disappeared,
     * this throws POST.NOT_FOUND.
     */
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    /*
     * If the post still exists, the missing foreign key
     * was most likely a parent deleted concurrently.
     */
    if (parentCommentId) {
      throw this.createParentNotFoundError();
    }

    throw PostAccessService.createNotFoundError();
  }

createNotFoundError() {
  return new AppError({
    code:
      ErrorCodes.COMMENT.NOT_FOUND,

    message:
      "Comment not found.",

    statusCode:
      HttpStatus.NOT_FOUND,
  });
}

  createParentNotFoundError() {
    return new AppError({
      code:
        ErrorCodes.COMMENT.PARENT_NOT_FOUND,
      message:
        "Parent comment was not found on this post.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createCommentFailedError() {
    return new AppError({
      code:
        ErrorCodes.COMMENT.CREATE_FAILED,
      message:
        "Comment could not be created.",
      statusCode:
        HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

export default new PostCommentsService();