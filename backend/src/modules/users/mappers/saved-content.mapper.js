import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class SavedContentMapper {
static toSavedLocation(row) {
  return {
    id: row.location_id,
    itemType: row.item_type,
    title: row.location_name,
    savedAt: row.saved_at,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    address: row.address ?? null,
    city: row.city_id ? { id: row.city_id, name: row.city_name,
      googleId: row.city_google_id ?? null } : null,
    country: row.country_id ? { id: row.country_id, name: row.country_name } : null,
    image: row.image_id ? { id: row.image_id, mimeType: row.image_mime_type,
      url: buildAssetUrl({ assetId: row.image_id, storageProvider: row.image_storage_provider,
        storageKey: row.image_storage_key, isPublic: true }) } : null,
    viewerState: { saved: true },
  };
}

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

      type:
        row.location_type ??
        "PLACE",

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
