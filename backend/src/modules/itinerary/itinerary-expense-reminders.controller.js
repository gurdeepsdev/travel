import Response from "../../core/response/index.js";
import Service from "./itinerary-expense-reminders.service.js";

class ItineraryExpenseRemindersController {
  async create(req, res, next) {
    try {
      const result = await Service.create({ itineraryId: req.validated.params.itineraryId,
        userId: req.user.id, input: req.validated.body });
      return Response.created(res, result, "Expense reminder sent successfully.");
    } catch (error) { return next(error); }
  }
}

export default new ItineraryExpenseRemindersController();
