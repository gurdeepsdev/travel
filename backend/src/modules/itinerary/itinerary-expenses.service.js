import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import Repository from "./itinerary-expenses.repository.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";
import { buildAssetUrl } from "../users/utils/asset-url.util.js";

const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

class ItineraryExpensesService {
  async getDashboard({ itineraryId, userId }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const [summary, balances] = await Promise.all([
      Repository.getSummary({ tripId: trip.trip_id }),
      Repository.getBalances({ tripId: trip.trip_id }),
    ]);
    return {
      itineraryId,
      expenseCount: summary.expense_count,
      totals: summary.totals.map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount),
        categories: Object.fromEntries(Object.entries(item.categories)
          .map(([category, amount]) => [category, Number(amount)])),
      })),
      balances: this.mapBalances(balances),
    };
  }

  async getBalances({ itineraryId, userId }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    return {
      itineraryId,
      balances: this.mapBalances(await Repository.getBalances({ tripId: trip.trip_id })),
    };
  }

  mapBalances(rows) {
    return rows.map((row) => ({
      user: {
        id: row.user_id,
        username: row.username,
        displayName: row.display_name,
      },
      currencyCode: row.currency_code,
      paidAmount: Number(row.paid_amount),
      shareAmount: Number(row.share_amount),
      netAmount: Number(row.net_amount),
    }));
  }

  async replaceExpenseSplits({ itineraryId, expenseId, userId, input }) {
    const existing = await Repository.findEditable({ itineraryId, expenseId, userId });
    if (!existing) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_NOT_FOUND,
        message: "Editable expense not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const splits = this.calculateSplits(input);
    const userIds = [...new Set(splits.map((split) => split.userId))];
    const activeIds = await Repository.findActiveParticipantIds({
      tripId: existing.resolved_trip_id,
      userIds,
    });
    if (activeIds.length !== userIds.length) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_INVALID,
        message: "Split users must be active expense participants.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    await Repository.replaceSplits({
      expenseId,
      amount: input.amount,
      splitType: input.splitType,
      splits,
    });
    const expense = await Repository.findById({
      tripId: existing.resolved_trip_id,
      expenseId,
      viewerUserId: userId,
    });
    return { expense: this.mapExpense(expense, itineraryId, userId) };
  }

  async deleteExpense({ itineraryId, expenseId, userId }) {
    const existing = await Repository.findEditable({ itineraryId, expenseId, userId });
    if (!existing) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_NOT_FOUND,
        message: "Deletable expense not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const deleted = await Repository.softDelete({ expenseId });
    return {
      deleted: true,
      expenseId: deleted.id,
      deletedAt: deleted.deleted_at,
    };
  }

  async updateExpense({ itineraryId, expenseId, userId, input }) {
    const existing = await Repository.findEditable({
      itineraryId,
      expenseId,
      userId,
    });
    if (!existing) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_NOT_FOUND,
        message: "Editable expense not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (input.paidBy) {
      const activePayers = await Repository.findActiveParticipantIds({
        tripId: existing.resolved_trip_id,
        userIds: [input.paidBy],
      });
      if (activePayers.length !== 1) {
        throw new AppError({
          code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_INVALID,
          message: "Payer must be an active expense participant.",
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
    }

    if (input.receiptAssetId && !await Repository.receiptBelongsToUser({
      assetId: input.receiptAssetId,
      userId,
    })) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_RECEIPT_INVALID,
        message: "Receipt asset is unavailable or is not owned by the editor.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    await Repository.update({ expenseId, input });
    const expense = await Repository.findById({
      tripId: existing.resolved_trip_id,
      expenseId,
      viewerUserId: userId,
    });
    return { expense: this.mapExpense(expense, itineraryId, userId) };
  }

  async getExpense({ itineraryId, expenseId, userId }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const expense = await Repository.findById({
      tripId: trip.trip_id,
      expenseId,
      viewerUserId: userId,
    });
    if (!expense) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_NOT_FOUND,
        message: "Expense not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return { expense: this.mapExpense(expense, itineraryId, userId) };
  }

  mapExpense(expense, itineraryId, viewerUserId) {
    const viewerShare = Number(expense.viewer_share ?? 0);
    const viewerPaid = expense.paid_by === viewerUserId
      ? Number(expense.amount)
      : 0;
    return {
      id: expense.id,
      itineraryId,
      tripId: expense.trip_id,
      payer: {
        id: expense.paid_by,
        username: expense.payer_username,
        displayName: expense.payer_display_name,
        profilePhoto: expense.payer_photo_id ? {
          id: expense.payer_photo_id,
          url: buildAssetUrl({
            assetId: expense.payer_photo_id,
            storageProvider: expense.payer_photo_storage_provider,
            storageKey: expense.payer_photo_storage_key,
            isPublic: expense.payer_photo_is_public,
          }),
          mimeType: expense.payer_photo_mime_type,
        } : null,
      },
      creator: {
        id: expense.created_by,
        username: expense.creator_username,
        displayName: expense.creator_display_name,
      },
      category: expense.expense_category,
      title: expense.title,
      description: expense.description,
      amount: Number(expense.amount),
      currencyCode: expense.currency_code.trim(),
      paymentMethod: expense.payment_method,
      expenseDate: expense.expense_date,
      locationName: expense.location_name,
      splitType: expense.split_type,
      receipt: expense.receipt_asset_id ? {
        assetId: expense.receipt_asset_id,
        url: buildAssetUrl({
          assetId: expense.receipt_asset_id,
          storageProvider: expense.receipt_storage_provider,
          storageKey: expense.receipt_storage_key,
          isPublic: expense.receipt_is_public,
        }),
        mimeType: expense.receipt_mime_type,
      } : null,
      splits: (expense.splits ?? []).map((split) => ({
        ...split,
        amount: Number(split.amount),
        percentage: split.percentage === null ? null : Number(split.percentage),
      })),
      viewerState: {
        paidAmount: viewerPaid,
        shareAmount: viewerShare,
        netAmount: viewerPaid - viewerShare,
      },
      createdAt: expense.created_at,
      updatedAt: expense.updated_at,
    };
  }

  async listExpenses({ itineraryId, userId, limit, cursor, category }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const result = await Repository.list({
      tripId: trip.trip_id,
      viewerUserId: userId,
      limit,
      cursor: decodeCursor(cursor),
      category,
    });
    return {
      expenses: result.rows.map((expense) =>
        this.mapExpense(expense, itineraryId, userId)),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.hasMore && result.lastRow
          ? encodeCursor({ createdAt: result.lastRow.created_at, id: result.lastRow.id })
          : null,
      },
    };
  }

  invalidSplit(message) {
    return new AppError({
      code: ErrorCodes.ITINERARY.EXPENSE_SPLIT_INVALID,
      message,
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  }

  calculateSplits(input) {
    const seen = new Set();
    for (const participant of input.participants) {
      if (seen.has(participant.userId)) {
        throw this.invalidSplit("Each participant can appear only once.");
      }
      seen.add(participant.userId);
    }

    const totalCents = toCents(input.amount);
    if (input.splitType === "EQUAL") {
      if (input.participants.some((item) => item.amount !== undefined || item.percentage !== undefined)) {
        throw this.invalidSplit("Equal splits accept only participant user IDs.");
      }
      const base = Math.floor(totalCents / input.participants.length);
      let remainder = totalCents - base * input.participants.length;
      return input.participants.map((item) => ({
        userId: item.userId,
        amount: fromCents(base + (remainder-- > 0 ? 1 : 0)),
        percentage: null,
      }));
    }

    if (input.splitType === "EXACT") {
      if (input.participants.some((item) => item.amount === undefined || item.percentage !== undefined)) {
        throw this.invalidSplit("Exact splits require an amount for every participant.");
      }
      const splitCents = input.participants.map((item) => toCents(item.amount));
      if (splitCents.reduce((sum, value) => sum + value, 0) !== totalCents) {
        throw this.invalidSplit("Exact split amounts must equal the expense amount.");
      }
      return input.participants.map((item, index) => ({
        userId: item.userId,
        amount: fromCents(splitCents[index]),
        percentage: null,
      }));
    }

    if (input.participants.some((item) => item.percentage === undefined || item.amount !== undefined)) {
      throw this.invalidSplit("Percentage splits require a percentage for every participant.");
    }
    const basisPoints = input.participants.map((item) => Math.round(item.percentage * 100));
    if (basisPoints.reduce((sum, value) => sum + value, 0) !== 10000) {
      throw this.invalidSplit("Split percentages must total exactly 100.");
    }
    const raw = basisPoints.map((value) => totalCents * value / 10000);
    const cents = raw.map(Math.floor);
    const remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);
    const order = raw.map((value, index) => ({ index, fraction: value - cents[index] }))
      .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
    for (let index = 0; index < remainder; index += 1) {
      cents[order[index].index] += 1;
    }
    return input.participants.map((item, index) => ({
      userId: item.userId,
      amount: fromCents(cents[index]),
      percentage: item.percentage.toFixed(2),
    }));
  }

  async createExpense({ itineraryId, userId, input }) {
    const trip = await Repository.findAccessibleTrip({ itineraryId, userId });
    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary trip not found or is inaccessible.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const splits = this.calculateSplits(input);
    const requiredUserIds = [...new Set([input.paidBy, ...splits.map((item) => item.userId)])];
    const activeUserIds = await Repository.findActiveParticipantIds({
      tripId: trip.trip_id,
      userIds: requiredUserIds,
    });
    if (activeUserIds.length !== requiredUserIds.length) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_INVALID,
        message: "Payer and split users must be active expense participants.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    if (input.receiptAssetId && !await Repository.receiptBelongsToUser({
      assetId: input.receiptAssetId,
      userId,
    })) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_RECEIPT_INVALID,
        message: "Receipt asset is unavailable or is not owned by the creator.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const created = await Repository.create({
      tripId: trip.trip_id,
      createdBy: userId,
      input,
      splits,
    });

    return {
      expense: {
        id: created.expense.id,
        itineraryId,
        tripId: created.expense.trip_id,
        paidBy: created.expense.paid_by,
        createdBy: created.expense.created_by,
        category: created.expense.expense_category,
        title: created.expense.title,
        description: created.expense.description,
        amount: Number(created.expense.amount),
        currencyCode: created.expense.currency_code.trim(),
        paymentMethod: created.expense.payment_method,
        expenseDate: created.expense.expense_date,
        receiptAssetId: created.expense.receipt_asset_id,
        locationName: created.expense.location_name,
        splitType: created.expense.split_type,
        splits: created.splits.map((split) => ({
          id: split.id,
          userId: split.user_id,
          amount: Number(split.amount),
          percentage: split.percentage === null ? null : Number(split.percentage),
          settlementStatus: split.settlement_status,
        })),
        createdAt: created.expense.created_at,
        updatedAt: created.expense.updated_at,
      },
    };
  }
}

export default new ItineraryExpensesService();
