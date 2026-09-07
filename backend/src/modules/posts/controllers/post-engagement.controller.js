import Response from "../../../core/response/index.js";
import PostEngagementService from "../services/post-engagement.service.js";

class PostEngagementController {
  async getBatch(req, res, next) {
    try {
      const result = await PostEngagementService.getBatch({
        postIds: req.validated.body.postIds,
        viewerUserId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "Post engagement fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostEngagementController();
