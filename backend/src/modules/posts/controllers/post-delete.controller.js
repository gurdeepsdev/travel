import Response
  from "../../../core/response/index.js";

import PostDeleteService
  from "../services/post-delete.service.js";

class PostDeleteController {
  async deletePost(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await PostDeleteService
          .deletePost({
            postId:
              req.validated.params.postId,

            userId:
              req.user.id,
          });

      return Response.success(
        res,
        result,
        "Post deleted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostDeleteController();
