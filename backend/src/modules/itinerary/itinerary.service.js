import ItineraryRepository
  from "./itinerary.repository.js";
import AppError
  from "../../core/errors/app-error.js";
import ErrorCodes
  from "../../shared/constants/error-codes.js";
import HttpStatus
  from "../../shared/constants/http-status.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../shared/utils/cursor.js";

const OWNER_FIELDS = [
  "user id",
  "user_id",
  "userId",
];

function buildTitle(
  cityId,
) {
  const cityName = cityId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );

  return `${cityName} itinerary`
    .slice(0, 255);
}

function removeClientOwnerFields(
  payload,
) {
  const itineraryJson = {
    ...payload,
  };

  for (const field of OWNER_FIELDS) {
    delete itineraryJson[field];
  }

  return itineraryJson;
}

function mapItinerary(
  itinerary,
) {
  return {
    id:
      itinerary.id,
    createdBy:
      itinerary.created_by,
    title:
      itinerary.title,
    durationDays:
      itinerary.duration_days,
    visibility:
      itinerary.visibility,
    tripStatus:
      itinerary.trip_status,
    aiGenerated:
      itinerary.ai_generated,
    itineraryJson:
      itinerary.itinerary_json,
    createdAt:
      itinerary.created_at,
    updatedAt:
      itinerary.updated_at,
  };
}

function mapItinerarySummary(
  itinerary,
) {
  const mapped =
    mapItinerary(itinerary);

  delete mapped.itineraryJson;

  return mapped;
}

class ItineraryService {
  async updateItineraryStatus({
    itineraryId,
    userId,
    status,
  }) {
    const result =
      await ItineraryRepository
        .updateOwnedLifecycleStatus({
          itineraryId,
          userId,
          status,
        });

    if (!result) {
      throw this.createNotFoundError();
    }

    if (
      result.invalid_transition
    ) {
      throw new AppError({
        code:
          ErrorCodes.ITINERARY
            .INVALID_STATUS_TRANSITION,
        message:
          `Itinerary status cannot transition from ${result.current_status} to ${status}.`,
        statusCode:
          HttpStatus.CONFLICT,
        details: {
          currentStatus:
            result.current_status,
          requestedStatus:
            status,
        },
      });
    }

    return {
      itineraryId:
        result.id,
      tripId:
        result.trip_id,
      previousStatus:
        result.previous_status,
      status:
        result.current_status,
      updated:
        result.updated,
      startedAt:
        result.started_at,
      completedAt:
        result.completed_at,
      updatedAt:
        result.updated_at,
    };
  }

  createNotFoundError() {
    return new AppError({
      code:
        ErrorCodes.ITINERARY.NOT_FOUND,
      message:
        "Itinerary not found.",
      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }

  async getItinerary({
    itineraryId,
    userId,
  }) {
    const itinerary =
      await ItineraryRepository
        .findOwnedById({
          itineraryId,
          userId,
        });

    if (!itinerary) {
      throw this.createNotFoundError();
    }

    return {
      itinerary:
        mapItinerary(
          itinerary,
        ),
    };
  }

  async listItineraries({
    userId,
    limit = 20,
    cursor = null,
    tripStatus = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const result =
      await ItineraryRepository
        .listOwned({
          userId,
          limit,
          cursor:
            decodedCursor,
          tripStatus,
        });

    const nextCursor =
      result.hasMore &&
      result.lastRow
        ? encodeCursor({
            createdAt:
              result.lastRow
                .cursor_created_at ??
              result.lastRow
                .created_at,
            id:
              result.lastRow.id,
          })
        : null;

    return {
      itineraries:
        result.rows.map(
          mapItinerarySummary,
        ),
      pagination: {
        hasMore:
          result.hasMore,
        nextCursor,
      },
    };
  }

  async listCompletedItineraries({
    userId,
    limit = 20,
    cursor = null,
  }) {
    return this.listItineraries({
      userId,
      limit,
      cursor,
      tripStatus: "completed",
    });
  }

  async saveItinerary({
    userId,
    payload,
  }) {
    const itineraryJson =
      removeClientOwnerFields(
        payload,
      );

    const itinerary =
      await ItineraryRepository.create({
        userId,
        title:
          buildTitle(
            itineraryJson.city_id,
          ),
        durationDays:
          itineraryJson.summary
            .num_days,
        itineraryJson,
      });

    return {
      itinerary:
        mapItinerary(
          itinerary,
        ),
    };
  }
}

export default new ItineraryService();
