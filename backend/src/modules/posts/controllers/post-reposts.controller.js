import Response from "../../../core/response/index.js";

import PostRepostsService from "../services/post-reposts.service.js";

class PostRepostsController {
  async setRepost(req, res, next) {
    try {
      const result =
        await PostRepostsService
          .setRepost({
            postId:
              req.validated.params
                .postId,

            userId:
              req.user.id,

            message:
              req.validated.body
                .message ?? null,
          });

      return Response.success(
        res,
        result,
        "Post reposted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async removeRepost(req, res, next) {
    try {
      const result =
        await PostRepostsService
          .removeRepost({
            postId:
              req.validated.params
                .postId,

            userId:
              req.user.id,
          });

      return Response.success(
        res,
        result,
        "Repost removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostRepostsController();
