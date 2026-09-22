import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

import PostDeleteMapper
  from "../mappers/post-delete.mapper.js";

import PostsRepository
  from "../repositories/posts.repository.js";
import logger
  from "../../../core/logger/logger.js";
import {
  enqueueVideoStorageSync,
} from "../../media/video-processing.queue.js";

class PostDeleteService {
  async deletePost({
    postId,
    userId,
  }) {
    const deletedPost =
      await PostsRepository
        .softDeleteOwned({
          postId,
          userId,
        });

    /*
     * Return the same response when the post is missing,
     * already deleted, or belongs to another user.
     */
    if (!deletedPost) {
      throw new AppError({
        code:
          ErrorCodes.POST.NOT_FOUND,

        message:
          "Post not found.",

        statusCode:
          HttpStatus.NOT_FOUND,
      });
    }

    try {
      await enqueueVideoStorageSync(
        deletedPost
          .storage_sync_assets,
      );
    } catch (error) {
      logger.error(
        {
          postId,
          error,
        },
        "Video storage sync could not be queued after post deletion.",
      );
    }

    return PostDeleteMapper
      .toResponse(
        deletedPost,
      );
  }
}

export default new PostDeleteService();
