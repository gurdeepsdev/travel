import Response from "../../core/response/index.js";
import Service from "./itinerary-expense-participants.service.js";

class ItineraryExpenseParticipantsController {
  async removeParticipant(req, res, next) {
    try {
      const result = await Service.removeParticipant({
        itineraryId: req.validated.params.itineraryId,
        ownerUserId: req.user.id,
        targetUserId: req.validated.params.userId,
      });

      return Response.success(
        res,
        result,
        "Expense participant removed successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async listParticipants(req, res, next) {
    try {
      const result = await Service.listParticipants({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
      });

      return Response.success(
        res,
        result,
        "Expense participants fetched successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }

  async addParticipant(req, res, next) {
    try {
      const result = await Service.addParticipant({
        itineraryId: req.validated.params.itineraryId,
        ownerUserId: req.user.id,
        targetUserId: req.validated.body.userId,
      });

      return Response.created(
        res,
        result,
        "Expense participant added successfully.",
      );
    } catch (error) {
      return next(error);
    }
  }
}

export default new ItineraryExpenseParticipantsController();
