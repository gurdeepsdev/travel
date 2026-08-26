import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class SavedContentMapper {
static toMySavedPostGroupsResponse({
  rows,
  postsById,
  groupBy,
  hasMore,
  nextCursor,
}) {
  return {
    groupBy,
    groups: (rows ?? []).map(
      (row) => {
        const previewPosts =
          (row.preview_post_ids ?? [])
            .map(
              (postId) =>
                postsById.get(
                  String(postId),
                ),
            )
            .filter(Boolean);

        return {
          id: row.id,
          name: row.name,
          postCount: Number(
            row.post_count ?? 0,
          ),
          coverImage:
            previewPosts[0]
              ?.coverAsset ??
            previewPosts[0]
              ?.assets?.[0] ??
            null,
          previewPosts,
        };
      },
    ),
    pagination: {
      hasMore:
        hasMore === true,
      nextCursor:
        nextCursor ?? null,
    },
  };
}

static toMySavedPostsResponse({
  posts,
  hasMore,
  nextCursor,
}) {
  return {
    posts: posts ?? [],

    pagination: {
      hasMore:
        hasMore === true,

      nextCursor:
        nextCursor ?? null,
    },
  };
}



    
  static toPublicPlace(row) {
    if (!row) {
      return null;
    }

    const image =
      row.image_id
        ? {
            id: row.image_id,

            storageProvider:
              row.image_storage_provider ??
              null,

            bucket:
              row.image_bucket ?? null,

            storageKey:
              row.image_storage_key ??
              null,

            url: buildAssetUrl(
              row.image_storage_key,
            ),

            mimeType:
              row.image_mime_type ??
              null,
          }
        : null;

    return {
      id: row.id,

      title:
        row.name ?? null,

      description:
        row.description ?? null,

      image,

      address:
        row.address ?? null,

      latitude:
        row.latitude === null ||
        row.latitude === undefined
          ? null
          : Number(row.latitude),

      longitude:
        row.longitude === null ||
        row.longitude === undefined
          ? null
          : Number(row.longitude),

      rating:
        row.rating === null ||
        row.rating === undefined
          ? null
          : Number(row.rating),

      reviewCount: Number(
        row.review_count ?? 0,
      ),

      isVerified:
        row.is_verified === true,

      isClosed:
        row.is_closed === true,
    };
  }

  static toPublicPlacesResponse({
    username,
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      username,

      places: (rows ?? [])
        .map((row) =>
          this.toPublicPlace(row),
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

export default SavedContentMapper;
