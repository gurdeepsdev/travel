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
 * Partially updates the authenticated user's
 * profile.
 *
 * Route:
 * PATCH /api/v1/users/me/profile
 */
async updateMyProfile(
  req,
  res,
  next,
) {
  try {
    const profile =
      await ProfileService
         .updateMyProfile({
          userId:
            req.user.id,

          changes:
            req.validated.body,

          profilePhotoFile:
            req.file ?? null,

          logger:
            req.logger ?? null,
        });

    return Response.success(
      res,
      {
        profile,
      },
      "Profile updated successfully.",
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

  async getUserPosts(req, res, next) {
    try {
      const viewerUserId =
        req.user?.id ??
        req.user?.userId ??
        req.auth?.userId ??
        null;
  
      const result =
        await PostService.getUserPosts({
          username: req.params.username,
          viewerUserId,
          limit: req.query.limit,
          cursor: req.query.cursor ?? null,
        });
  
      return res.status(200).json({
        success: true,
        message:
          "User posts fetched successfully.",
        data: result,
        requestId:
          req.requestId ??
          req.id ??
          null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new UsersController();
