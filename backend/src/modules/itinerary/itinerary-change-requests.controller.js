import Response from "../../core/response/index.js";
import Service from "./itinerary-change-requests.service.js";

class ItineraryChangeRequestsController {
  async create(req, res, next) {
    try {
      const result = await Service.create({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.created(res, result, "Itinerary place-change request created successfully.");
    } catch (error) { return next(error); }
  }

  async list(req, res, next) {
    try {
      const result = await Service.list({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        ...req.validated.query,
      });
      return Response.success(res, result, "Itinerary change requests fetched successfully.");
    } catch (error) { return next(error); }
  }

  async get(req, res, next) {
    try {
      const result = await Service.get({
        itineraryId: req.validated.params.itineraryId,
        requestId: req.validated.params.requestId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Itinerary change request fetched successfully.");
    } catch (error) { return next(error); }
  }

  async review(req, res, next) {
    try {
      const result = await Service.review({
        itineraryId: req.validated.params.itineraryId,
        requestId: req.validated.params.requestId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.success(res, result, "Itinerary change request reviewed successfully.");
    } catch (error) { return next(error); }
  }

  async cancel(req, res, next) {
    try {
      const result = await Service.cancel({
        itineraryId: req.validated.params.itineraryId,
        requestId: req.validated.params.requestId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Itinerary change request cancelled successfully.");
    } catch (error) { return next(error); }
  }
}

export default new ItineraryChangeRequestsController();
