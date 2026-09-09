import Response from "../../core/response/index.js";
import Service from "./itinerary-expenses.service.js";

class ItineraryExpensesController {
  async getDashboard(req, res, next) {
    try {
      const result = await Service.getDashboard({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Expense dashboard fetched successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async getBalances(req, res, next) {
    try {
      const result = await Service.getBalances({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Expense balances fetched successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async replaceExpenseSplits(req, res, next) {
    try {
      const result = await Service.replaceExpenseSplits({
        itineraryId: req.validated.params.itineraryId,
        expenseId: req.validated.params.expenseId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.success(res, result, "Expense splits updated successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async deleteExpense(req, res, next) {
    try {
      const result = await Service.deleteExpense({
        itineraryId: req.validated.params.itineraryId,
        expenseId: req.validated.params.expenseId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Expense deleted successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async updateExpense(req, res, next) {
    try {
      const result = await Service.updateExpense({
        itineraryId: req.validated.params.itineraryId,
        expenseId: req.validated.params.expenseId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.success(res, result, "Expense updated successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async getExpense(req, res, next) {
    try {
      const result = await Service.getExpense({
        itineraryId: req.validated.params.itineraryId,
        expenseId: req.validated.params.expenseId,
        userId: req.user.id,
      });
      return Response.success(res, result, "Expense fetched successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async listExpenses(req, res, next) {
    try {
      const result = await Service.listExpenses({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        limit: req.validated.query.limit,
        cursor: req.validated.query.cursor,
        category: req.validated.query.category,
      });
      return Response.success(res, result, "Expenses fetched successfully.");
    } catch (error) {
      return next(error);
    }
  }

  async createExpense(req, res, next) {
    try {
      const result = await Service.createExpense({
        itineraryId: req.validated.params.itineraryId,
        userId: req.user.id,
        input: req.validated.body,
      });
      return Response.created(res, result, "Expense created successfully.");
    } catch (error) {
      return next(error);
    }
  }
}

export default new ItineraryExpensesController();
