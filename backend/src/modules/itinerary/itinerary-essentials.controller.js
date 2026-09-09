import Response from "../../core/response/index.js";
import ItineraryEssentialsService
  from "./itinerary-essentials.service.js";

class ItineraryEssentialsController {
  async createEssential(req, res, next) {
    try {
      const result =
        await ItineraryEssentialsService
          .createEssential({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId: req.user.id,
            input: req.validated.body,
          });

      return Response.created(
        res,
        result,
        "Travel essential created successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listEssentials(req, res, next) {
    try {
      const result =
        await ItineraryEssentialsService
          .listEssentials({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Travel essentials fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async updateEssential(req, res, next) {
    try {
      const result =
        await ItineraryEssentialsService
          .updateEssential({
            itineraryId:
              req.validated.params
                .itineraryId,
            essentialId:
              req.validated.params
                .essentialId,
            userId: req.user.id,
            input: req.validated.body,
          });

      return Response.success(
        res,
        result,
        "Travel essential updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async setEssentialSelection(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryEssentialsService
          .setEssentialSelection({
            itineraryId:
              req.validated.params
                .itineraryId,
            essentialId:
              req.validated.params
                .essentialId,
            userId: req.user.id,
            selected:
              req.validated.body.selected,
          });

      return Response.success(
        res,
        result,
        "Travel essential selection updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async deleteEssential(req, res, next) {
    try {
      const result =
        await ItineraryEssentialsService
          .deleteEssential({
            itineraryId:
              req.validated.params
                .itineraryId,
            essentialId:
              req.validated.params
                .essentialId,
            userId: req.user.id,
          });

      return Response.success(
        res,
        result,
        "Travel essential deleted successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ItineraryEssentialsController();
