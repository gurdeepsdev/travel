import Response
  from "../../../core/response/index.js";

import VisitedPlacesService
  from "../services/visited-places.service.js";

class VisitedPlacesController {
  /**
   * Verifies a historical gallery photo and,
   * when accepted, records its attraction and city.
   *
   * Route:
   * POST /api/v1/users/me/visited-place-verifications
   */
  async submitVerification(
    req,
    res,
    next,
  ) {
    try {
      const {
        placeId,
        googlePlaceId,
        googleCityPlaceId,
        claimedVisitedAt = null,
      } = req.validated.body;

      const result =
        await VisitedPlacesService
          .submitVerification({
            userId:
              req.user.id,

            placeId,

            googlePlaceId,

            googleCityPlaceId,

            claimedVisitedAt,

            verificationPhotoFile:
              req.file,

            logger:
              req.logger ?? null,
          });

      return Response.created(
        res,
        result,
        "Visited place verified successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

    /**
   * Selects or deselects a verified city for
   * display on the authenticated user's profile.
   *
   * Route:
   * PATCH /api/v1/users/me/visited-collections/:collectionId/preference
   */
  async updateCollectionPreference(
    req,
    res,
    next,
  ) {
    try {
      const {
        collectionId,
      } = req.validated.params;

      const {
        isPreference,
      } = req.validated.body;

      const result =
        await VisitedPlacesService
          .updateCollectionPreference({
            userId:
              req.user.id,

            collectionId,

            isPreference,
          });

      const message =
        isPreference
          ? "Verified city selected for profile display."
          : "Verified city removed from profile display.";

      return Response.success(
        res,
        result,
        message,
      );
    } catch (error) {
      return next(error);
    }
  }


    /**
   * Lists verified places visited by the
   * authenticated user.
   *
   * Route:
   * GET /api/v1/users/me/visited-places
   */
  async getMyVisitedPlaces(
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
        await VisitedPlacesService
          .getMyVisitedPlaces({
            userId:
              req.user.id,

            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Visited places fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default
  new VisitedPlacesController();
