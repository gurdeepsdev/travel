import {
  buildAssetUrl,
} from "../../users/utils/asset-url.util.js";

class PostBeenThereMapper {
    static toResponse({
      postId,
      viewerBeenThere,
      beenThereCount,
    }) {
      return {
        postId,
        viewerBeenThere:
          viewerBeenThere === true,
        beenThereCount: Number(
          beenThereCount ?? 0,
        ),
      };
    }
static toListItem(row) {
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

    /*
     * created_at means when the user marked the post,
     * not necessarily when they physically visited.
     */
    markedAt: row.created_at,

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

      relationship: {
        status:
          row.relationship_status ??
          "NONE",

        connectionId:
          row.relationship_status ===
          "CONNECTED"
            ? row.relationship_connection_id ??
              null
            : null,

        requestId:
          row.relationship_status ===
            "OUTGOING_PENDING" ||
          row.relationship_status ===
            "INCOMING_PENDING"
            ? row.relationship_request_id ??
              null
            : null,
      },
    },
  };
}

static toListResponse({
  postId,
  rows,
  beenThereCount,
  hasMore,
  nextCursor,
}) {
  return {
    postId,

    beenThereCount: Number(
      beenThereCount ?? 0,
    ),

    visitors:
      rows.map((row) =>
        this.toListItem(row),
      ),

    pagination: {
      hasMore:
        hasMore === true,

      nextCursor:
        nextCursor ?? null,
    },
  };
}

  }
  
  export default PostBeenThereMapper;
