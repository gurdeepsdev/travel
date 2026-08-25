import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import UserPostsRepository from "../../users/repositories/posts.repository.js";

import PostRepostsMapper from "../mappers/post-reposts.mapper.js";
import PostRepostsRepository from "../repositories/post-reposts.repository.js";

import PostAccessService from "./post-access.service.js";

class PostRepostsService {
  async resolveTarget({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    const originalPostId =
      await PostRepostsRepository
        .resolveOriginalPostId({
          postId,
        });

    if (!originalPostId) {
      throw PostAccessService
        .createNotFoundError();
    }

    const original =
      await PostAccessService
        .assertCanInteract({
          postId: originalPostId,
          userId,
        });

    if (
      String(original.user_id) ===
      String(userId)
    ) {
      throw new AppError({
        code:
          ErrorCodes.POST
            .REPOST_NOT_ALLOWED,

        message:
          "A post owner cannot repost their own post.",

        statusCode:
          HttpStatus.BAD_REQUEST,

        details: null,
      });
    }

    return {
      originalPostId,
    };
  }

  async setRepost({
    postId,
    userId,
    message = null,
  }) {
    const { originalPostId } =
      await this.resolveTarget({
        postId,
        userId,
      });

    const mutation =
      await PostRepostsRepository.set({
        originalPostId,
        userId,
        message,
      });

    if (!mutation) {
      throw PostAccessService
        .createNotFoundError();
    }

    const posts =
      await UserPostsRepository
        .getPostsByIds({
          postIds: [mutation.postId],
          viewerUserId: userId,
        });

    const post = posts[0] ?? null;

    if (!post) {
      throw new AppError({
        code:
          ErrorCodes.POST
            .CREATE_FAILED,

        message:
          "Repost was created but could not be loaded.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details: {
          postId: mutation.postId,
        },
      });
    }

    return PostRepostsMapper
      .toSetResponse({
        originalPostId,
        post,
      });
  }

  async removeRepost({
    postId,
    userId,
  }) {
    const { originalPostId } =
      await this.resolveTarget({
        postId,
        userId,
      });

    await PostRepostsRepository.remove({
      originalPostId,
      userId,
    });

    return PostRepostsMapper
      .toRemoveResponse({
        originalPostId,
      });
  }
}

export default new PostRepostsService();
