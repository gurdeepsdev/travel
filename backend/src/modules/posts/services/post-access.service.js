import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import PostsRepository from "../repositories/posts.repository.js";

class PostAccessService {
  /**
   * Confirms that a user may see and interact with
   * the requested post.
   *
   * Inaccessible posts intentionally return the same
   * error as nonexistent posts.
   */
  async assertCanInteract({
    postId,
    userId,
  }) {
    const post =
      await PostsRepository.findAccessContext({
        postId,
        viewerUserId: userId,
      });

    if (!post) {
      throw this.createNotFoundError();
    }

    const isOwner =
      String(post.user_id) === String(userId);

    if (isOwner) {
      return post;
    }

    const visibility =
      String(post.visibility ?? "")
        .trim()
        .toUpperCase();

    const canInteract =
      visibility === "PUBLIC" &&
      !post.owner_profile_is_private &&
      !post.has_block_relationship;

    if (!canInteract) {
      throw this.createNotFoundError();
    }

    return post;
  }

  createNotFoundError() {
    return new AppError({
      code: ErrorCodes.POST.NOT_FOUND,
      message: "Post not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export default new PostAccessService();