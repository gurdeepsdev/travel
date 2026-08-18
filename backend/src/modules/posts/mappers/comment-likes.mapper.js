import {
  buildAssetUrl,
} from "../../users/utils/asset-url.util.js";

class CommentLikesMapper {
  static toResponse({
    commentId,
    state,
  }) {
    return {
      commentId,

      viewerHasLiked:
        state?.viewer_has_liked === true,

      likeCount: Number(
        state?.like_count ?? 0,
      ),
    };
  }

  static toListItem(row) {
    if (!row) {
      return null;
    }

    const profilePhoto =
      row.profile_photo_id
        ? {
            id:
              row.profile_photo_id,

            storageProvider:
              row.profile_photo_storage_provider ??
              null,

            bucket:
              row.profile_photo_bucket ??
              null,

            storageKey:
              row.profile_photo_storage_key ??
              null,

            url: buildAssetUrl(
              row.profile_photo_storage_key,
            ),

            mimeType:
              row.profile_photo_mime_type ??
              null,
          }
        : null;

    return {
      id: row.id,

      likedAt:
        row.created_at,

      user: {
        id: row.user_id,

        username:
          row.username ?? null,

        displayName:
          row.display_name ?? null,

        isVerified:
          row.is_verified === true,

        isPrivate:
          row.is_private === true,

        profilePhoto,

        viewerIsSelf:
          row.viewer_is_self === true,
      },
    };
  }

  static toListResponse({
    commentId,
    likeCount,
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      commentId,

      likeCount: Number(
        likeCount ?? 0,
      ),

      users: (rows ?? [])
        .map((row) =>
          this.toListItem(row),
        )
        .filter(Boolean),

      pagination: {
        hasMore:
          hasMore === true,

        nextCursor:
          nextCursor ?? null,
      },
    };
  }
}

export default CommentLikesMapper;