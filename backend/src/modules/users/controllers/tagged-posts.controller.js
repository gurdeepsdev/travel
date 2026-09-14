import Response from "../../../core/response/index.js";
import Service from "../services/tagged-posts.service.js";

class TaggedPostsController {
  async list(req, res, next) {
    try {
      const result = await Service.list({
        username: req.validated.params?.username,
        viewerUserId: req.user?.id ?? req.user?.userId ?? req.auth?.userId ?? null,
        ...req.validated.query,
      });
      return Response.success(res, result, "Tagged posts fetched successfully.");
    } catch (error) { return next(error); }
  }
}

export default new TaggedPostsController();
