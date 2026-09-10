import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import ItineraryEssentialsRepository
  from "./itinerary-essentials.repository.js";

function mapEssential(
  essential,
  itineraryId,
) {
  return {
    id: essential.id,
    itineraryId:
      itineraryId,
    tripId: essential.trip_id,
    title: essential.title,
    category: essential.category,
    selected:
      essential.is_completed === true,
    displayOrder:
      essential.display_order,
    createdAt: essential.created_at,
    updatedAt: essential.updated_at,
  };
}

class ItineraryEssentialsService {
  createNotFoundError() {
    return new AppError({
      code: ErrorCodes.ITINERARY.NOT_FOUND,
      message: "Itinerary not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createTripRequiredError() {
    return new AppError({
      code:
        ErrorCodes.ITINERARY
          .TRIP_NOT_STARTED,
      message:
        "Move the itinerary to UPCOMING before using travel essentials.",
      statusCode: HttpStatus.CONFLICT,
    });
  }

  createEssentialNotFoundError() {
    return new AppError({
      code: ErrorCodes.ITINERARY.NOT_FOUND,
      message: "Travel essential not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  async requireOwnedTrip({
    itineraryId,
    userId,
  }) {
    const itineraryTrip =
      await ItineraryEssentialsRepository
        .findOwnedItineraryTrip({
          itineraryId,
          userId,
        });

    if (!itineraryTrip) {
      throw this.createNotFoundError();
    }

    if (!itineraryTrip.trip_id) {
      throw this.createTripRequiredError();
    }

    return itineraryTrip;
  }

  async createEssential({
    itineraryId,
    userId,
    input,
  }) {
    const itineraryTrip =
      await this.requireOwnedTrip({
        itineraryId,
        userId,
      });

    const essential =
      await ItineraryEssentialsRepository
        .create({
          tripId: itineraryTrip.trip_id,
          userId,
          input,
        });

    return {
      essential:
        mapEssential(
          essential,
          itineraryId,
        ),
    };
  }

  async listEssentials({
    itineraryId,
    userId,
  }) {
    await this.requireOwnedTrip({
      itineraryId,
      userId,
    });

    const essentials =
      await ItineraryEssentialsRepository
        .listOwned({
          itineraryId,
          userId,
        });

    const markedCount =
      essentials.filter(
        (essential) =>
          essential.is_completed === true,
      ).length;
    const totalCount = essentials.length;
    const emergencyContacts = await ItineraryEssentialsRepository.getEmergencyContacts({ itineraryId, userId });

    return {
      emergencyContacts,
      essentials:
        essentials.map(
          (essential) =>
            mapEssential(
              essential,
              itineraryId,
            ),
        ),
      summary: {
        totalCount,
        markedCount,
        unmarkedCount:
          totalCount - markedCount,
        completionPercentage:
          totalCount === 0
            ? 0
            : Number((
                markedCount /
                totalCount *
                100
              ).toFixed(2)),
      },
    };
  }

  async updateEssential({
    itineraryId,
    essentialId,
    userId,
    input,
  }) {
    const essential =
      await ItineraryEssentialsRepository
        .updateOwned({
          itineraryId,
          essentialId,
          userId,
          input,
        });

    if (!essential) {
      throw this
        .createEssentialNotFoundError();
    }

    return {
      essential:
        mapEssential(
          essential,
          itineraryId,
        ),
    };
  }

  async setEssentialSelection({
    itineraryId,
    essentialId,
    userId,
    selected,
  }) {
    const essential =
      await ItineraryEssentialsRepository
        .setSelectionOwned({
          itineraryId,
          essentialId,
          userId,
          selected,
        });

    if (!essential) {
      throw this
        .createEssentialNotFoundError();
    }

    return {
      essential:
        mapEssential(
          essential,
          itineraryId,
        ),
    };
  }

  async deleteEssential({
    itineraryId,
    essentialId,
    userId,
  }) {
    const essential =
      await ItineraryEssentialsRepository
        .deleteOwned({
          itineraryId,
          essentialId,
          userId,
        });

    if (!essential) {
      throw this
        .createEssentialNotFoundError();
    }

    return {
      deleted: true,
      essentialId: essential.id,
    };
  }
}

export default new ItineraryEssentialsService();
