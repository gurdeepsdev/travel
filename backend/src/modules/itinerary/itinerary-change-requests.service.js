import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";
import Repository from "./itinerary-change-requests.repository.js";

class ItineraryChangeRequestsService {
  notFound() {
    return new AppError({
      code: ErrorCodes.ITINERARY.CHANGE_REQUEST_NOT_FOUND,
      message: "Itinerary change request was not found or is unavailable.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  map(row) {
    return {
      id: row.id,
      itineraryId: row.itinerary_id,
      requestType: "PLACE_CHANGES",
      proposedChanges: row.proposed_data,
      message: row.message,
      status: row.status,
      requester: row.requester_username === undefined ? {
        id: row.requested_by,
      } : {
        id: row.requested_by,
        username: row.requester_username,
        displayName: row.requester_display_name,
      },
      reviewer: row.reviewed_by ? {
        id: row.reviewed_by,
        username: row.reviewer_username ?? null,
        displayName: row.reviewer_display_name ?? null,
      } : null,
      reviewMessage: row.review_message ?? null,
      baseItineraryUpdatedAt: row.base_itinerary_updated_at,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create({ itineraryId, userId, input }) {
    const proposedData = {
      days: input.days,
      totalPlaces: input.days.reduce(
        (total, day) => total + day.items.length,
        0,
      ),
    };
    const request = await Repository.create({
      itineraryId,
      userId,
      proposedData,
      message: input.message,
    });
    if (!request) { throw this.notFound(); }
    return { changeRequest: this.map(request) };
  }

  async list({ itineraryId, userId, status, limit, cursor }) {
    const result = await Repository.list({
      itineraryId,
      userId,
      status,
      limit,
      cursor: decodeCursor(cursor),
    });
    if (!result) { throw this.notFound(); }
    const last = result.rows.at(-1);
    return {
      changeRequests: result.rows.map((row) => this.map(row)),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.hasMore && last ? encodeCursor({
          createdAt: last.created_at,
          id: last.id,
        }) : null,
      },
    };
  }

  async get({ itineraryId, requestId, userId }) {
    const request = await Repository.findById({ itineraryId, requestId, userId });
    if (!request) { throw this.notFound(); }
    return { changeRequest: this.map(request) };
  }

  async review({ itineraryId, requestId, userId, input }) {
    const result = await Repository.review({
      itineraryId,
      requestId,
      userId,
      decision: input.decision,
      message: input.message,
    });
    if (!result || result.unavailable) { throw this.notFound(); }
    if (result.stale) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.CHANGE_REQUEST_STALE,
        message: "The itinerary changed after this request was submitted.",
        statusCode: HttpStatus.CONFLICT,
        details: { changeRequest: this.map(result.request) },
      });
    }
    return {
      changeRequest: this.map(result.request),
      itinerary: result.itinerary ? {
        id: result.itinerary.id,
        updatedAt: result.itinerary.updated_at,
      } : null,
    };
  }

  async cancel({ itineraryId, requestId, userId }) {
    const request = await Repository.cancel({ itineraryId, requestId, userId });
    if (!request) { throw this.notFound(); }
    return { changeRequest: this.map(request) };
  }
}

export default new ItineraryChangeRequestsService();
