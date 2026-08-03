import Response from "../../../core/response/index.js";

import PostSavesService from "../services/post-saves.service.js";

class PostSavesController {
  /**
   * Saves or reactivates a post for the
   * authenticated user.
   */
  async savePost(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const result =
        await PostSavesService.savePost({
          postId,
          userId: req.user.id,
        });

      return Response.success(
        res,
        result,
        "Post saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Soft-removes a saved post for the
   * authenticated user.
   */
  async removeSavedPost(
    req,
    res,
    next,
  ) {
    try {
      const { postId } =
        req.validated.params;

      const result =
        await PostSavesService
          .removeSavedPost({
            postId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Saved post removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostSavesController();