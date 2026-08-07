import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class ConnectionsMapper {
    /**
   * Maps one pending incoming connection request.
   */
  static toIncomingItem(row) {
    if (!row?.id) {
      return null;
    }

    return {
      id:
        row.id,

      senderUserId:
        row.request_sender_user_id,

      receiverUserId:
        row.receiver_user_id,

      status:
        row.status,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,

      resolvedAt:
        row.resolved_at ??
        null,

      sender:
        this.toUser(
          row,
          "sender",
        ),
    };
  }

  /**
   * Maps one pending outgoing connection request.
   */
  static toOutgoingItem(row) {
    if (!row?.id) {
      return null;
    }

    return {
      id:
        row.id,

      senderUserId:
        row.sender_user_id,

      receiverUserId:
        row.request_receiver_user_id,

      status:
        row.status,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,

      resolvedAt:
        row.resolved_at ??
        null,

      recipient:
        this.toUser(
          row,
          "recipient",
        ),
    };
  }

  /**
   * Maps a paginated outgoing-request list.
   */
  static toOutgoingListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      connectionRequests:
        (rows ?? [])
          .map((row) =>
            this.toOutgoingItem(
              row,
            ),
          )
          .filter(Boolean),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ??
          null,
      },
    };
  }

  /**
   * Maps a paginated incoming-request list.
   */
  static toIncomingListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      connectionRequests:
        (rows ?? [])
          .map((row) =>
            this.toIncomingItem(
              row,
            ),
          )
          .filter(Boolean),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ??
          null,
      },
    };
  }
  
  
    /**
   * Maps user information from a prefixed SQL row.
   *
   * Examples:
   * - target_user_id
   * - sender_user_id
   * - receiver_user_id
   * - connection_user_id
   */
  static toUser(
    row,
    prefix,
  ) {
    const userId =
      row?.[`${prefix}_user_id`] ??
      null;

    if (!userId) {
      return null;
    }

    const profilePhotoId =
      row[
        `${prefix}_profile_photo_id`
      ] ?? null;

    const profilePhotoStorageProvider =
      row[
        `${prefix}_profile_photo_storage_provider`
      ] ?? null;

    const profilePhotoStorageKey =
      row[
        `${prefix}_profile_photo_storage_key`
      ] ?? null;

    const profilePhotoIsPublic =
      row[
        `${prefix}_profile_photo_is_public`
      ] === true;

    return {
      id:
        userId,

      username:
        row[
          `${prefix}_username`
        ] ?? null,

      displayName:
        row[
          `${prefix}_display_name`
        ] ?? null,

      isVerified:
        row[
          `${prefix}_is_verified`
        ] === true,

      isPrivate:
        row[
          `${prefix}_is_private`
        ] === true,

      profilePhoto:
        profilePhotoId
          ? {
              id:
                profilePhotoId,

              storageProvider:
                profilePhotoStorageProvider,

              bucket:
                row[
                  `${prefix}_profile_photo_bucket`
                ] ?? null,

              storageKey:
                profilePhotoStorageKey,

              url:
                buildAssetUrl({
                  assetId:
                    profilePhotoId,

                  storageProvider:
                    profilePhotoStorageProvider,

                  storageKey:
                    profilePhotoStorageKey,

                  isPublic:
                    profilePhotoIsPublic,
                }),

              mimeType:
                row[
                  `${prefix}_profile_photo_mime_type`
                ] ?? null,
            }
          : null,
    };
  }

  /**
   * Maps an accepted or rejected connection request.
   */
  static toRespondResponse(row) {
    if (!row?.id) {
      return null;
    }

    return {
      actionApplied:
        row.action_applied === true,

      connectionRequest: {
        id:
          row.id,

        senderUserId:
          row.sender_user_id,

        receiverUserId:
          row.receiver_user_id,

        status:
          row.status,

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at,

        resolvedAt:
          row.resolved_at ??
          null,

        sender:
          this.toUser(
            row,
            "sender",
          ),
      },

      connection:
        row.connection_id
          ? {
              id:
                row.connection_id,

              userLowId:
                row.user_low_id,

              userHighId:
                row.user_high_id,

              connectedAt:
                row.connected_at,
            }
          : null,
    };
  }

  /**
   * Maps one accepted connection.
   *
   * Canonical low/high pair fields are intentionally
   * not exposed as frontend user roles.
   */
  static toConnectionItem(row) {
    if (!row?.id) {
      return null;
    }

    return {
      id:
        row.id,

      connectedAt:
        row.connected_at,

      user:
        this.toUser(
          row,
          "connection",
        ),
    };
  }

  /**
   * Maps the authenticated user's accepted
   * connection list.
   */
  static toConnectionsListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      connections:
        (rows ?? [])
          .map((row) =>
            this.toConnectionItem(
              row,
            ),
          )
          .filter(Boolean),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ??
          null,
      },
    };
  }


    /**
   * Maps a removed connection without exposing
   * canonical low/high database fields.
   */
  static toRemoveResponse({
    row,
    connectedUserId,
  }) {
    if (!row?.id) {
      return null;
    }

    return {
      removed:
        true,

      connection: {
        id:
          row.id,

        userId:
          connectedUserId,

        connectedAt:
          row.connected_at,
      },
    };
  }
  
    /**
   * Maps a newly or previously cancelled request.
   */
  static toCancelResponse(row) {
    if (!row?.id) {
      return null;
    }

    return {
      actionApplied:
        row.action_applied === true,

      connectionRequest: {
        id:
          row.id,

        senderUserId:
          row.sender_user_id,

        receiverUserId:
          row.receiver_user_id,

        status:
          row.status,

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at,

        resolvedAt:
          row.resolved_at ??
          null,

        recipient:
          this.toUser(
            row,
            "recipient",
          ),
      },
    };
  }

  /**
   * Maps the result returned after sending or
   * idempotently retrieving a pending request.
   */
  static toSendResponse(row) {
    if (!row?.id) {
      return null;
    }

    return {
      requestCreated:
        row.request_created === true,

      connectionRequest: {
        id:
          row.id,

        senderUserId:
          row.sender_user_id,

        receiverUserId:
          row.receiver_user_id,

        status:
          row.status,

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at,

        resolvedAt:
          row.resolved_at ??
          null,

        recipient:
          this.toUser(
            row,
            "target",
          ),
      },
    };
  }
}

export default ConnectionsMapper;