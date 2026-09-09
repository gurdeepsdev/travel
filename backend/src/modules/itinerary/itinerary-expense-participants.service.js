import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import Repository from "./itinerary-expense-participants.repository.js";
import { buildAssetUrl } from "../users/utils/asset-url.util.js";

class ItineraryExpenseParticipantsService {
  async removeParticipant({ itineraryId, ownerUserId, targetUserId }) {
    if (ownerUserId === targetUserId) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_OWNER_REMOVAL_FORBIDDEN,
        message: "The trip owner cannot be removed from expense participants.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    const participant = await Repository.removeOwned({
      itineraryId,
      ownerUserId,
      targetUserId,
    });

    if (!participant) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_NOT_FOUND,
        message: "Active expense participant not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    return {
      removed: true,
      participantId: participant.id,
      userId: participant.user_id,
      status: participant.status,
      removedAt: participant.removed_at,
    };
  }

  async listParticipants({ itineraryId, userId }) {
    const trip = await Repository.findAccessibleTrip({
      itineraryId,
      userId,
    });

    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const participants = await Repository.listActive({
      tripId: trip.trip_id,
    });

    return {
      participants: participants.map((participant) => ({
        id: participant.id,
        itineraryId,
        tripId: participant.trip_id,
        user: {
          id: participant.user_id,
          username: participant.username,
          displayName: participant.display_name,
          isVerified: participant.is_verified === true,
          profilePhoto: participant.profile_photo_id
            ? {
                id: participant.profile_photo_id,
                url: buildAssetUrl({
                  assetId: participant.profile_photo_id,
                  storageProvider: participant.profile_photo_storage_provider,
                  storageKey: participant.profile_photo_storage_key,
                  isPublic: participant.profile_photo_is_public,
                }),
                mimeType: participant.profile_photo_mime_type,
              }
            : null,
        },
        isOwner: participant.is_owner === true,
        status: participant.status,
        joinedAt: participant.joined_at,
      })),
      totalCount: participants.length,
    };
  }

  async addParticipant({ itineraryId, ownerUserId, targetUserId }) {
    const trip = await Repository.findOwnedTrip({
      itineraryId,
      ownerUserId,
    });

    if (!trip) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (!trip.trip_id) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.TRIP_NOT_STARTED,
        message: "Move the itinerary to UPCOMING before adding expense participants.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    if (await Repository.findActive({
      tripId: trip.trip_id,
      userId: targetUserId,
    })) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_ALREADY_EXISTS,
        message: "User is already an active expense participant.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    const target = await Repository.findEligibleConnection({
      ownerUserId,
      targetUserId,
    });

    if (!target) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.EXPENSE_PARTICIPANT_NOT_ELIGIBLE,
        message: "Only an active accepted connection can be added.",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const participant = await Repository.add({
      tripId: trip.trip_id,
      userId: targetUserId,
      addedBy: ownerUserId,
    });

    return {
      participant: {
        id: participant.id,
        itineraryId,
        tripId: participant.trip_id,
        user: {
          id: target.user_id,
          username: target.username,
          displayName: target.display_name,
        },
        status: participant.status,
        joinedAt: participant.joined_at,
        createdAt: participant.created_at,
        updatedAt: participant.updated_at,
      },
    };
  }
}

export default new ItineraryExpenseParticipantsService();
