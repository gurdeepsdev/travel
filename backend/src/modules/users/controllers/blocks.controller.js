import Response
  from "../../../core/response/index.js";

import BlocksService
  from "../services/blocks.service.js";

class BlocksController {
  async blockUser(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await BlocksService
          .blockUser({
            userId:
              req.user.id,

            blockedUserId:
              req.validated.params
                .userId,
          });

      return Response.success(
        res,
        result,
        "User blocked successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async unblockUser(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await BlocksService
          .unblockUser({
            userId:
              req.user.id,

            blockedUserId:
              req.validated.params
                .userId,
          });

      return Response.success(
        res,
        result,
        result.unblocked
          ? "User unblocked successfully."
          : "User was not blocked.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getBlockedUsers(
    req,
    res,
    next,
  ) {
    try {
      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await BlocksService
          .getBlockedUsers({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Blocked users fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new BlocksController();
