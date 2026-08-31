import Response
  from "../../core/response/index.js";

import ItineraryService
  from "./itinerary.service.js";

class ItineraryController {
  async updateItinerary(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .updateItinerary({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId: req.user.id,
            payload:
              req.validated.body,
          });

      return Response.success(
        res,
        result,
        "Itinerary updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async updateItineraryStatus(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .updateItineraryStatus({
            itineraryId:
              req.validated.params
                .itineraryId,
            userId:
              req.user.id,
            status:
              req.validated.body
                .status,
          });

      return Response.success(
        res,
        result,
        "Itinerary status updated successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listCompletedItineraries(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .listCompletedItineraries({
            userId:
              req.user.id,
            limit:
              req.validated.query
                .limit,
            cursor:
              req.validated.query
                .cursor,
          });

      return Response.success(
        res,
        result,
        "Completed itineraries fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listItineraries(
    req,
    res,
    next,
  ) {
    try {
      const result =
        await ItineraryService
          .listItineraries({
            userId:
              req.user.id,
            limit:
              req.validated.query
                .limit,
            cursor:
              req.validated.query
                .cursor,
          });

      return Response.success(
        res,
        result,
        "Itineraries fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

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
