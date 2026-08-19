import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class BlocksMapper {
  static toBlockedUser(
    row,
  ) {
    if (
      !row?.blocked_user_id
    ) {
      return null;
    }

    const profilePhotoId =
      row
        .blocked_profile_photo_id ??
      null;

    const storageProvider =
      row
        .blocked_profile_photo_storage_provider ??
      null;

    const storageKey =
      row
        .blocked_profile_photo_storage_key ??
      null;

    return {
      id:
        row.blocked_user_id,

      username:
        row.blocked_username ??
        null,

      displayName:
        row.blocked_display_name ??
        null,

      isVerified:
        row.blocked_is_verified ===
        true,

      isPrivate:
        row.blocked_is_private ===
        true,

      profilePhoto:
        profilePhotoId
          ? {
              id:
                profilePhotoId,

              url:
                buildAssetUrl({
                  assetId:
                    profilePhotoId,

                  storageProvider,

                  storageKey,

                  isPublic:
                    row
                      .blocked_profile_photo_is_public ===
                    true,
                }),

              mimeType:
                row
                  .blocked_profile_photo_mime_type ??
                null,
            }
          : null,
    };
  }

  static toBlockResponse(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    return {
      blocked:
        true,

      block: {
        id:
          row.id,

        createdAt:
          row.created_at,

        user:
          this.toBlockedUser(
            row,
          ),
      },

      connectionRemoved:
        row.connection_removed ===
        true,

      connectionRequestsCancelled:
        Number(
          row.requests_cancelled ??
          0,
        ),
    };
  }

  static toUnblockResponse({
    row,
    blockedUserId,
  }) {
    return {
      unblocked:
        Boolean(
          row?.id,
        ),

      userId:
        blockedUserId,
    };
  }

  static toListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      blockedUsers:
        (rows ?? [])
          .map((row) => ({
            blockId:
              row.id,

            blockedAt:
              row.created_at,

            user:
              this.toBlockedUser(
                row,
              ),
          }))
          .filter(
            (item) =>
              item.user,
          ),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ??
          null,
      },
    };
  }
}

export default BlocksMapper;
