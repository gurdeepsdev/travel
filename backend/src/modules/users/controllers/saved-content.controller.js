import Response from "../../../core/response/index.js";

import SavedContentService from "../services/saved-content.service.js";

class SavedContentController {

    /**
 * Returns complete saved posts for the
 * authenticated user.
 */
async getMySavedPosts(
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
      await SavedContentService
        .getMySavedPosts({
          userId: req.user.id,
          limit,
          cursor,
        });

    return Response.success(
      res,
      result,
      "Saved posts fetched successfully.",
    );
  } catch (error) {
    return next(error);
  }
}
  /**
   * Returns public POI cards derived from a
   * user's accessible saved posts.
   */
  async getUserSavedPlaces(
    req,
    res,
    next,
  ) {
    try {
      const { username } =
        req.validated.params;

      const {
        limit,
        cursor = null,
      } = req.validated.query;

      const result =
        await SavedContentService
          .getUserSavedPlaces({
            username,

            viewerUserId:
              req.user?.id ?? null,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Saved places fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new SavedContentController();