import Response from "../../core/response/index.js";
import Service from "./itinerary-expense-settlements.service.js";

class ItineraryExpenseSettlementsController {
  async create(req, res, next) {
    try {
      const result = await Service.create({ itineraryId: req.validated.params.itineraryId,
        userId: req.user.id, input: req.validated.body });
      return Response.created(res, result, "Expense settlement created successfully.");
    } catch (error) { return next(error); }
  }

  async list(req, res, next) {
    try {
      const result = await Service.list({ itineraryId: req.validated.params.itineraryId,
        userId: req.user.id, ...req.validated.query });
      return Response.success(res, result, "Expense settlements fetched successfully.");
    } catch (error) { return next(error); }
  }

  async update(req, res, next) {
    try {
      const result = await Service.update({ itineraryId: req.validated.params.itineraryId,
        settlementId: req.validated.params.settlementId, userId: req.user.id,
        status: req.validated.body.status });
      return Response.success(res, result, "Expense settlement updated successfully.");
    } catch (error) { return next(error); }
  }
}

export default new ItineraryExpenseSettlementsController();
