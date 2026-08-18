import Response from "../../../core/response/index.js";

import ReportsService from "../services/reports.service.js";

class ReportsController {
  async reportUser(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ReportsService
          .reportUser({
            reporterUserId:
              req.user.id,

            reportedUserId:
              req.validated.params
                .userId,

            reasonCode:
              req.validated.body
                .reasonCode,

            description:
              req.validated.body
                .description ??
              null,
          });

      return Response.created(
        res,
        result,
        "User report submitted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async reportPost(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ReportsService
          .reportPost({
            reporterUserId:
              req.user.id,

            reportedPostId:
              req.validated.params
                .postId,

            reasonCode:
              req.validated.body
                .reasonCode,

            description:
              req.validated.body
                .description ??
              null,
          });

      return Response.created(
        res,
        result,
        "Post report submitted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ReportsController();
