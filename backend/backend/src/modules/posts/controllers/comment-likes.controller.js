import Response from "../../../core/response/index.js";

import CommentLikesService from "../services/comment-likes.service.js";

class CommentLikesController {


    /**
 * Lists users who liked a comment.
 *
 * Only the owner of the post containing the
 * comment may access this list.
 */
async getCommentLikes(
  req,
  res,
  next,
) {
  try {
    const { commentId } =
      req.validated.params;

    const {
      limit,
      cursor = null,
    } = req.validated.query;

    const result =
      await CommentLikesService
        .getCommentLikes({
          commentId,
          userId:
            req.user.id,
          limit,
          cursor,
        });

    return Response.success(
      res,
      result,
      "Comment likes fetched successfully.",
    );
  } catch (error) {
    return next(error);
  }
}
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