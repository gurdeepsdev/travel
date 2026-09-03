import Response
  from "../../../core/response/index.js";
import PostVisibilityService
  from "../services/post-visibility.service.js";

class PostVisibilityController {
  async updateVisibility(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await PostVisibilityService
          .updateVisibility({
            postId:
              req.validated.params
                .postId,
            userId:
              req.user.id,
            visibility:
              req.validated.body
                .visibility,
          });

      return Response.success(
        res,
        result,
        "Post visibility updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostVisibilityController();
