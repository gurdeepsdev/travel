import Response
  from "../../../core/response/index.js";

import CitySavesService
  from "../services/city-saves.service.js";

class CitySavesController {
  async saveCity(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await CitySavesService.saveCity({
          cityId:
            req.validated.params.cityId,
          userId:
            req.user.id,
        });

      return Response.success(
        res,
        result,
        "City saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async removeSavedCity(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await CitySavesService
          .removeSavedCity({
            cityId:
              req.validated.params.cityId,
            userId:
              req.user.id,
          });

      return Response.success(
        res,
        result,
        "Saved city removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new CitySavesController();
