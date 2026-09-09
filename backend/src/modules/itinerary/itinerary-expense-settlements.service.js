import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";
import ExpensesRepository from "./itinerary-expenses.repository.js";
import Repository from "./itinerary-expense-settlements.repository.js";

class ItineraryExpenseSettlementsService {
  inaccessible() {
    return new AppError({
      code: ErrorCodes.ITINERARY.NOT_FOUND,
      message: "Itinerary trip not found or is inaccessible.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  notFound() {
    return new AppError({
      code: ErrorCodes.ITINERARY.EXPENSE_SETTLEMENT_NOT_FOUND,
      message: "Expense settlement not found or transition is not permitted.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  map(row) {
    return {
      id: row.id,
      tripId: row.trip_id,
      fromUser: { id: row.from_user_id, username: row.from_username,
        displayName: row.from_display_name },
      toUser: { id: row.to_user_id, username: row.to_username,
        displayName: row.to_display_name },
      amount: Number(row.amount),
      currencyCode: row.currency_code.trim(),
      status: row.status,
      createdBy: row.created_by,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create({ itineraryId, userId, input }) {
    const trip = await ExpensesRepository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw this.inaccessible();
    }
    const participants = await ExpensesRepository.findActiveParticipantIds({
      tripId: trip.trip_id,
      userIds: [userId, input.toUserId],
    });
    if (participants.length !== 2) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_INVALID,
        message: "Settlement users must be active expense participants.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    const balances = await ExpensesRepository.getBalances({ tripId: trip.trip_id });
    const sender = balances.find((row) => row.user_id === userId
      && row.currency_code === input.currencyCode);
    const receiver = balances.find((row) => row.user_id === input.toUserId
      && row.currency_code === input.currencyCode);
    const maximum = Math.min(-Number(sender?.net_amount ?? 0), Number(receiver?.net_amount ?? 0));
    if (maximum <= 0 || Number(input.amount) > maximum) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_SETTLEMENT_INVALID,
        message: "Settlement exceeds the outstanding balance between these users.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    return { settlement: this.map(await Repository.create({ tripId: trip.trip_id, userId, input })) };
  }

  async list({ itineraryId, userId, limit, cursor, status }) {
    const trip = await ExpensesRepository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw this.inaccessible();
    }
    const result = await Repository.list({
      tripId: trip.trip_id, limit, cursor: decodeCursor(cursor), status,
    });
    return {
      settlements: result.rows.map((row) => this.map(row)),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.hasMore && result.lastRow
          ? encodeCursor({ createdAt: result.lastRow.created_at, id: result.lastRow.id })
          : null,
      },
    };
  }

  async update({ itineraryId, settlementId, userId, status }) {
    const trip = await ExpensesRepository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw this.inaccessible();
    }
    const existing = await Repository.findById({ tripId: trip.trip_id, settlementId });
    if (!existing) {
      throw this.notFound();
    }
    const updated = await Repository.resolve({ settlementId, userId, status });
    if (!updated) {
      throw this.notFound();
    }
    return { settlement: this.map(updated) };
  }
}

export default new ItineraryExpenseSettlementsService();
