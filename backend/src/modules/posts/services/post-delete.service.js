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

    return PostDeleteMapper
      .toResponse(
        deletedPost,
      );
  }
}

export default new PostDeleteService();
