import Response from "../../../core/response/index.js";

import CommentLikesService from "../services/comment-likes.service.js";

class CommentLikesController {
  /**
   * Idempotently likes a comment for the
   * authenticated user.
   */
  async setLike(req, res, next) {
    try {
      const { commentId } =
        req.validated.params;

      const result =
        await CommentLikesService.setLike({
          commentId,
          userId: req.user.id,
        });

      return Response.success(
        res,
        result,
        "Comment liked successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Idempotently removes the authenticated
   * user's comment like.
   */
  async removeLike(req, res, next) {
    try {
      const { commentId } =
        req.validated.params;

      const result =
        await CommentLikesService
          .removeLike({
            commentId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Comment like removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new CommentLikesController();