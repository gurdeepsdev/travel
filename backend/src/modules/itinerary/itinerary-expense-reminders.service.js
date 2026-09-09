import AppError from "../../core/errors/app-error.js";
import redis from "../../config/redis.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import { emitUserEvent } from "../../realtime/realtime-server.js";
import Repository from "./itinerary-expenses.repository.js";

class ItineraryExpenseRemindersService {
  async create({ itineraryId, userId, input }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({ code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND });
    }
    const active = await Repository.findActiveParticipantIds({
      tripId: trip.trip_id, userIds: [userId, input.userId],
    });
    const balances = await Repository.getBalances({ tripId: trip.trip_id });
    const requester = balances.find((row) => row.user_id === userId
      && row.currency_code === input.currencyCode);
    const recipient = balances.find((row) => row.user_id === input.userId
      && row.currency_code === input.currencyCode);
    if (active.length !== 2 || Number(requester?.net_amount ?? 0) <= 0
      || Number(recipient?.net_amount ?? 0) >= 0) {
      throw new AppError({ code: ErrorCodes.ITINERARY.EXPENSE_REMINDER_INVALID,
        message: "A reminder can only be sent by a creditor to an owing participant.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY });
    }
    const key = `expense-reminder:${trip.trip_id}:${userId}:${input.userId}:${input.currencyCode}`;
    const accepted = await redis.set(key, "1", "EX", 86400, "NX");
    if (!accepted) {
      throw new AppError({ code: ErrorCodes.ITINERARY.EXPENSE_REMINDER_RATE_LIMITED,
        message: "A reminder was already sent to this participant in the last 24 hours.",
        statusCode: HttpStatus.TOO_MANY_REQUESTS });
    }
    const payload = { itineraryId, fromUserId: userId, currencyCode: input.currencyCode,
      amountOwed: Math.abs(Number(recipient.net_amount)), sentAt: new Date().toISOString() };
    try {
      emitUserEvent(input.userId, "expense.reminder.created", payload);
    } catch (error) {
      await redis.del(key);
      throw error;
    }
    return { reminder: payload };
  }
}

export default new ItineraryExpenseRemindersService();
