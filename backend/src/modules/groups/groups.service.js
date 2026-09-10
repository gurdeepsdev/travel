import AppError from "../../core/errors/app-error.js";
import HttpStatus from "../../shared/constants/http-status.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import { buildAssetUrl } from "../users/utils/asset-url.util.js";
import Repository from "./groups.repository.js";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor.js";

class GroupsService {
  mapGroup(group) {
    return { id: group.id, itineraryId: group.itinerary_id, ownerId: group.owner_id,
      name: group.name, description: group.description, status: group.status,
      createdAt: group.created_at, updatedAt: group.updated_at };
  }

  async createStandaloneGroup(args) {
    const group = await Repository.createStandaloneGroup(args);
    return { created: true, group: this.mapGroup(group) };
  }

  async linkItinerary(args) {
    const result = await Repository.linkItinerary(args);
    if (!result) {
      throw new AppError({ code: ErrorCodes.GROUP.NOT_FOUND,
        message: "Owned active group or itinerary not found.", statusCode: HttpStatus.NOT_FOUND });
    }
    if (result.conflict) {
      throw new AppError({ code: ErrorCodes.GROUP.ITINERARY_ALREADY_LINKED,
        message: "The group or itinerary already has a different link.", statusCode: HttpStatus.CONFLICT });
    }
    return { updated: result.updated, group: this.mapGroup(result.group) };
  }

  async removeMember(args) {
    const result = await Repository.removeMember(args);
    if (!result) {
      throw new AppError({ code: ErrorCodes.GROUP.MEMBER_NOT_FOUND,
        message: "Accessible group member not found.", statusCode: HttpStatus.NOT_FOUND });
    }
    if (result.error) {
      throw new AppError({ code: ErrorCodes.GROUP.OWNER_REMOVAL_FORBIDDEN,
        message: "The group owner cannot leave or be removed.", statusCode: HttpStatus.CONFLICT });
    }
    return result;
  }

  mapInvitation(row) {
    return {
      id: row.id, groupId: row.group_id, itineraryId: row.itinerary_id,
      groupName: row.group_name, invitedUserId: row.invited_user_id,
      invitedBy: row.invited_by, status: row.effective_status ?? row.status,
      message: row.message, expiresAt: row.expires_at, respondedAt: row.responded_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async listInvitations({ userId, limit = 20, cursor, status }) {
    const rows = await Repository.listInvitations({ userId, limit, cursor: decodeCursor(cursor), status });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { invitations: items.map((row) => this.mapInvitation(row)), pagination: {
      hasMore, nextCursor: hasMore ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null,
    } };
  }

  async respondToInvitation(args) {
    const result = await Repository.respondToInvitation(args);
    if (!result) {
      throw new AppError({ code: ErrorCodes.GROUP.INVITATION_NOT_FOUND,
        message: "Invitation not found.", statusCode: HttpStatus.NOT_FOUND });
    }
    if (result.error) {
      const messages = {
        INVITATION_RESOLVED: "Invitation has already been resolved.",
        INVITATION_EXPIRED: "Invitation has expired.",
        CONNECTION_REQUIRED: "An active, unblocked connection is required to accept.",
      };
      throw new AppError({ code: ErrorCodes.GROUP[result.error], message: messages[result.error],
        statusCode: result.error === 'CONNECTION_REQUIRED' ? HttpStatus.FORBIDDEN : HttpStatus.CONFLICT });
    }
    return { updated: result.updated, invitation: this.mapInvitation(result.invitation) };
  }

  async createInvitation({ itineraryId, userId, input }) {
    if (userId.toLowerCase() === input.userId.toLowerCase()) {
      throw new AppError({ code: ErrorCodes.GROUP.SELF_INVITATION,
        message: "You cannot invite yourself.", statusCode: HttpStatus.BAD_REQUEST });
    }
    const result = await Repository.createInvitation({ itineraryId, userId, input });
    if (!result) {
      throw new AppError({ code: ErrorCodes.GROUP.NOT_FOUND,
        message: "Owned itinerary group not found.", statusCode: HttpStatus.NOT_FOUND });
    }
    if (result.error) {
      throw new AppError({ code: ErrorCodes.GROUP[result.error],
        message: result.error === 'ALREADY_MEMBER'
          ? "User is already an active group member."
          : "An active, unblocked connection is required.",
        statusCode: result.error === 'ALREADY_MEMBER' ? HttpStatus.CONFLICT : HttpStatus.FORBIDDEN });
    }
    const invitation = result.invitation;
    return {
      created: result.created,
      invitation: {
        id: invitation.id, groupId: invitation.group_id, itineraryId,
        invitedUserId: invitation.invited_user_id, invitedBy: invitation.invited_by,
        status: invitation.status, message: invitation.message,
        expiresAt: invitation.expires_at, createdAt: invitation.created_at,
        updatedAt: invitation.updated_at,
      },
    };
  }

  async createLinkedGroup({ itineraryId, userId, input }) {
    const result = await Repository.createLinkedGroup({
      itineraryId,
      userId,
      input,
    });

    if (!result) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.NOT_FOUND,
        message: "Itinerary not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    if (result.conflict) {
      throw new AppError({
        code: ErrorCodes.GROUP.ITINERARY_ALREADY_LINKED,
        message: "This itinerary is already linked to another group.",
        statusCode: HttpStatus.CONFLICT,
      });
    }

    const { group } = result;
    return {
      created: result.created,
      group: {
        id: group.id,
        itineraryId: group.itinerary_id,
        ownerId: group.owner_id,
        name: group.name,
        description: group.description,
        status: group.status,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      },
    };
  }

  async listLinkedGroupMembers({ itineraryId, userId }) {
    const group = await Repository.findAccessibleLinkedGroup({
      itineraryId,
      userId,
    });

    if (!group) {
      throw new AppError({
        code: ErrorCodes.GROUP.NOT_FOUND,
        message: "Itinerary group not found.",
        statusCode: HttpStatus.NOT_FOUND,
      });
    }

    const members = await Repository.listActiveMembers({
      groupId: group.id,
    });

    return {
      group: {
        id: group.id,
        itineraryId: group.itinerary_id,
        ownerId: group.owner_id,
        name: group.name,
        description: group.description,
        status: group.status,
      },
      members: members.map((member) => ({
        id: member.id,
        user: {
          id: member.user_id,
          username: member.username,
          displayName: member.display_name,
          isVerified: member.is_verified === true,
          profilePhoto: member.profile_photo_id
            ? {
                id: member.profile_photo_id,
                url: buildAssetUrl({
                  assetId: member.profile_photo_id,
                  storageProvider: member.profile_photo_storage_provider,
                  storageKey: member.profile_photo_storage_key,
                  isPublic: member.profile_photo_is_public,
                }),
                mimeType: member.profile_photo_mime_type,
              }
            : null,
        },
        role: member.role,
        status: member.status,
        joinedAt: member.joined_at,
        createdAt: member.created_at,
        updatedAt: member.updated_at,
      })),
      totalCount: members.length,
    };
  }
}

export default new GroupsService();
