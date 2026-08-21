import Response
  from "../../../core/response/index.js";

import ExploreService
  from "../services/explore.service.js";

class ExploreController {
  async getCities(
    req,
    res,
    next,
  ) {
    try {
      const {
        category = "FOR_YOU",
        limit = 10,
      } = req.validated.query;

      const result =
        await ExploreService
          .getCities({
            category,
            limit,
          });

      return Response.success(
        res,
        result,
        "Explore cities fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getCityPlaces(
    req,
    res,
    next,
  ) {
    try {
      const {
        cityId,
      } = req.validated.params;

      const {
        limit = 20,
      } = req.validated.query;

      const result =
        await ExploreService
          .getCityPlaces({
            cityId,
            limit,
          });

      return Response.success(
        res,
        result,
        "City places fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getPlaces(
    req,
    res,
    next,
  ) {
    try {
      const {
        latitude = null,
        longitude = null,
        radiusKm = 50,
        limit = 10,
      } = req.validated.query;

      const result =
        await ExploreService
          .getPlaces({
            latitude,
            longitude,
            radiusKm,
            limit,
          });

      return Response.success(
        res,
        result,
        "Explore places fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async getFeed(
    req,
    res,
    next,
  ) {
    try {
      const {
        latitude = null,
        longitude = null,
        radiusKm = 50,
        limit = 20,
        cursor = null,
      } = req.validated.query;

      const result =
        await ExploreService
          .getFeed({
            viewerUserId:
              req.user?.id ??
              null,

            latitude,
            longitude,
            radiusKm,
            limit,
            cursor,
          });

      return Response.success(
        res,
        result,
        "Explore feed fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ExploreController();
