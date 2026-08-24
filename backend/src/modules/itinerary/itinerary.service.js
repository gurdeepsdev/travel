import ItineraryRepository
  from "./itinerary.repository.js";
import AppError
  from "../../core/errors/app-error.js";
import ErrorCodes
  from "../../shared/constants/error-codes.js";
import HttpStatus
  from "../../shared/constants/http-status.js";

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

class ItineraryService {
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
