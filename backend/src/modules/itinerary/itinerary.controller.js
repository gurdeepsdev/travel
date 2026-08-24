import Response
  from "../../core/response/index.js";

import ItineraryService
  from "./itinerary.service.js";

class ItineraryController {
  async getItinerary(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .getItinerary({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId:
              req.user.id,
          });

      return Response.success(
        res,
        result,
        "Itinerary fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async saveItinerary(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .saveItinerary({
            userId:
              req.user.id,
            payload:
              req.validated.body,
          });

      return Response.created(
        res,
        result,
        "Itinerary saved successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ItineraryController();
