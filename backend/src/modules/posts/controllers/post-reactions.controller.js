import Response from "../../../core/response/index.js";

import PostReactionsService from "../services/post-reactions.service.js";

class PostReactionsController {
  /**
   * Creates or replaces the authenticated user's
   * reaction on a post.
   */
async getPostReactions(
  req,
  res,
  next,
) {
  try {
    const { postId } =
      req.validated.params;

    const {
      reactionType = null,
      limit,
      cursor = null,
    } = req.validated.query;

    const result =
      await PostReactionsService
        .getPostReactions({
          postId,

          viewerUserId:
            req.user?.id ?? null,

          reactionType,
          limit,
          cursor,
        });

    return Response.success(
      res,
      result,
      "Post reactions fetched successfully.",
    );
  } catch (error) {
    return next(error);
  }
}

  async setReaction(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const { reactionType } =
        req.validated.body;

      const result =
        await PostReactionsService.setReaction({
          postId,
          userId: req.user.id,
          reactionType,
        });

      return Response.success(
        res,
        result,
        "Post reaction saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Removes the authenticated user's reaction
   * from a post.
   */
  async removeReaction(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const result =
        await PostReactionsService.removeReaction({
          postId,
          userId: req.user.id,
        });

      return Response.success(
        res,
        result,
        "Post reaction removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostReactionsController();