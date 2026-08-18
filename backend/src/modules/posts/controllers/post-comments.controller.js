import Response from "../../../core/response/index.js";

import PostCommentsService from "../services/post-comments.service.js";

class PostCommentsController {



    /**
   * Returns the top-level comments for a post.
   *
   * Authentication is optional. When available,
   * viewer-specific fields are included.
   */
  async getPostComments(
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
        await PostCommentsService
          .getPostComments({
            postId,

            viewerUserId:
              req.user?.id ?? null,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Post comments fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Creates a top-level comment or a reply.
   */
  async createComment(req, res, next) {
    try {
      const { postId } =
        req.validated.params;

      const {
        comment,
        parentCommentId = null,
      } = req.validated.body;

      const result =
        await PostCommentsService
          .createComment({
            postId,
            userId: req.user.id,
            comment,
            parentCommentId,
          });

      return Response.created(
        res,
        result,
        "Comment created successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
 * Deletes a comment.
 *
 * The comment author or the owner of the post
 * containing the comment may perform this action.
 */
async deleteComment(
  req,
  res,
  next,
) {
  try {
    const { commentId } =
      req.validated.params;

    const result =
      await PostCommentsService
        .deleteComment({
          commentId,
          userId:
            req.user.id,
        });

    return Response.success(
      res,
      result,
      "Comment deleted successfully.",
    );
  } catch (error) {
    return next(error);
  }
}
}

export default new PostCommentsController();