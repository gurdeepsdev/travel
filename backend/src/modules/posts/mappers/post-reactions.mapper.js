import {
    POST_REACTION_VALUES,
  } from "../post-reactions.constants.js";

  import {
  buildAssetUrl,
} from "../../users/utils/asset-url.util.js";

const buildAbsoluteAssetUrl = (
  asset,
) => {
  const assetUrl =
    buildAssetUrl(asset);

  if (
    !assetUrl ||
    /^https?:\/\//i.test(assetUrl)
  ) {
    return assetUrl;
  }

  const baseUrl =
    process.env.API_PUBLIC_BASE_URL
      ?.trim() ||
    `http://localhost:${
      process.env.APP_PORT || 3001
    }`;

  return `${baseUrl.replace(
    /\/+$/,
    "",
  )}/${assetUrl.replace(
    /^\/+/,
    "",
  )}`;
};
  
  class PostReactionsMapper {
    static toReaction(row) {
      if (!row) {
        return null;
      }
  
      return {
        id: row.id,
        postId: row.post_id,
        type: row.reaction_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  
    static toSummary(rows = []) {
      const byType = Object.fromEntries(
        POST_REACTION_VALUES.map((type) => [
          type,
          0,
        ]),
      );
  
      for (const row of rows) {
        if (
          Object.prototype.hasOwnProperty.call(
            byType,
            row.reaction_type,
          )
        ) {
          byType[row.reaction_type] = Number(
            row.reaction_count,
          );
        }
      }
  
      const total = Object.values(byType).reduce(
        (sum, count) => sum + count,
        0,
      );
  
      return {
        total,
        byType,
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

          url: buildAbsoluteAssetUrl({
            assetId:
              row.profile_photo_id,

            storageProvider:
              row.profile_photo_storage_provider,

            storageKey:
              row.profile_photo_storage_key,

            isPublic: true,
          }),

          mimeType:
            row.profile_photo_mime_type ??
            null,
        }
      : null;

  return {
    id: row.id,
    type: row.reaction_type,
    reactedAt: row.created_at,

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
  reactionType = null,
  rows,
  summaryRows,
  hasMore,
  nextCursor,
}) {
  const summary =
    this.toSummary(summaryRows);

  return {
    postId,

    filter: {
      reactionType,
    },

    reactionCount:
      summary.total,

    reactionSummary:
      summary.byType,

    reactions:
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
  
    static toMutationResponse({
      postId,
      reaction,
      summaryRows,
    }) {
      const summary = this.toSummary(summaryRows);
  
      return {
        postId,
        viewerReaction:
          reaction?.reaction_type ?? null,
        reaction: this.toReaction(reaction),
        reactionCount: summary.total,
        reactionSummary: summary.byType,
      };
    }
  }
  
  export default PostReactionsMapper;
