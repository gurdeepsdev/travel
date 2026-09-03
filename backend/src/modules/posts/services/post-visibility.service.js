import AppError
  from "../../../core/errors/app-error.js";
import ErrorCodes
  from "../../../shared/constants/error-codes.js";
import HttpStatus
  from "../../../shared/constants/http-status.js";
import PostsRepository
  from "../repositories/posts.repository.js";

class PostVisibilityService {
  async updateVisibility({
    postId,
    userId,
    visibility,
  }) {
    const post =
      await PostsRepository
        .updateVisibilityOwned({
          postId,
          userId,
          visibility,
        });

    if (!post) {
      throw new AppError({
        code:
          ErrorCodes.POST.NOT_FOUND,
        message:
          "Post not found.",
        statusCode:
          HttpStatus.NOT_FOUND,
      });
    }

    return {
      post: {
        id:
          post.id,
        visibility:
          post.visibility,
        updatedAt:
          post.updated_at,
      },
    };
  }
}

export default new PostVisibilityService();
