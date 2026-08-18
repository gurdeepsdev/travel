import Response from "../../../core/response/index.js";

import PostBeenThereService from "../services/post-been-there.service.js";

class PostBeenThereController {
  /**
   * Marks the authenticated user as having visited
   * the place represented by the post.
   */
async getPostBeenThere(
  req,
  res,
  next,
) {
  try {
    const { postId } =
      req.validated.params;

    const {
      limit,
      cursor = null,
    } = req.validated.query;

    const result =
      await PostBeenThereService
        .getPostBeenThere({
          postId,

          viewerUserId:
            req.user?.id ?? null,

          limit,
          cursor,
        });

    return Response.success(
      res,
      result,
      "Been There users fetched successfully.",
    );
  } catch (error) {
    return next(error);
  }
}


  async setBeenThere(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const result =
        await PostBeenThereService
          .setBeenThere({
            postId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Post marked as Been There.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Removes the authenticated user's Been There state.
   */
  async removeBeenThere(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const result =
        await PostBeenThereService
          .removeBeenThere({
            postId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Been There removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostBeenThereController();