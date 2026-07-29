import Response from "../../core/response/index.js";

import ProfileService from "./services/profile.service.js";
import PostService from "./services/post.service.js";

class UsersController {
  /**
   * Returns the authenticated user's profile.
   */
  async me(req, res, next) {
    try {
      const profile = await ProfileService.getMyProfile(
        req.user.id,
      );

      return Response.success(
        res,
        {
          profile,
        },
        "Profile fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Returns posts created or reposted by the authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/posts
   */
  async getMyPosts(req, res, next) {
    try {
      const userId = req.user.id;

      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result = await PostService.getMyPosts({
        userId,
        limit,
        cursor,
      });

      return Response.success(
        res,
        result,
        "Posts fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new UsersController();
