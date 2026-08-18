import PostSavesMapper from "../mappers/post-saves.mapper.js";
import PostSavesRepository from "../repositories/post-saves.repository.js";

import PostAccessService from "./post-access.service.js";

class PostSavesService {
  /**
   * Saves or reactivates a post for the
   * authenticated user.
   */
  async savePost({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    const savedItem =
      await PostSavesRepository.save({
        postId,
        userId,
      });

    /*
     * The repository uses a locked conditional
     * INSERT. A null row means the post disappeared
     * after the access check.
     */
    if (!savedItem) {
      throw PostAccessService
        .createNotFoundError();
    }

    const state =
      await PostSavesRepository.getState({
        postId,
        userId,
      });

    return PostSavesMapper.toResponse({
      postId,
      state,
    });
  }

  /**
   * Soft-removes a saved post.
   *
   * Repeated DELETE requests remain successful.
   */
  async removeSavedPost({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    await PostSavesRepository.remove({
      postId,
      userId,
    });

    const state =
      await PostSavesRepository.getState({
        postId,
        userId,
      });

    return PostSavesMapper.toResponse({
      postId,
      state,
    });
  }
}

export default new PostSavesService();