import Response from "../../../core/response/index.js";

import PostCreateService from "../services/post-create.service.js";

class PostCreateController {
  /**
   * Creates a place-based post using newly
   * uploaded files, existing owned assets,
   * itineraries, or a combination.
   */
  async createPost(
    req,
    res,
    next,
  ) {
    try {
      const {
        caption,
        visibility,
        placeId,
        googleId,
        existingAssetIds,
        mediaOrder,
        itineraryIds,
        taggedUserIds,
      } = req.validated.body;

      const result =
        await PostCreateService
          .createPost({
            userId:
              req.user.id,

            caption,
            visibility,
            placeId,
            googleId,
            existingAssetIds,
            mediaOrder,
            itineraryIds,
            taggedUserIds,

            files:
              req.files ?? [],

            logger:
              req.logger ?? null,
          });

      return Response.created(
        res,
        result,
        "Post created successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new PostCreateController();
