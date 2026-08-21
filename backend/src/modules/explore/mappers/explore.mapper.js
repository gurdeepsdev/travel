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

  const configuredBaseUrl =
    process.env
      .API_PUBLIC_BASE_URL
      ?.trim();

  const baseUrl =
    configuredBaseUrl ||
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

class ExploreMapper {
  static toCountry(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    const imageAssetId =
      row.image_asset_id ?? null;

    return {
      id: row.id,
      title: row.name,
      name: row.name,
      code: row.code ?? null,
      description:
        row.description ?? null,
      phonePrefix:
        row.phone_prefix ?? null,
      timezone:
        row.timezone ?? null,
      cityCount: Number(
        row.city_count ?? 0,
      ),
      placeCount: Number(
        row.place_count ?? 0,
      ),
      placesWithMedia: Number(
        row.places_with_media ?? 0,
      ),
      image: imageAssetId
        ? {
            id: imageAssetId,
            url: buildAbsoluteAssetUrl({
              assetId: imageAssetId,
              storageProvider:
                row.image_storage_provider,
              storageKey:
                row.image_storage_key,
              isPublic:
                row.image_is_public === true,
            }),
            mimeType:
              row.image_mime_type ?? null,
          }
        : null,
    };
  }

  static toCity(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    const imageAssetId =
      row.image_asset_id ??
      null;

    return {
      id:
        row.id,

      name:
        row.name,

      officialName:
        row.official_name ??
        null,

      latitude:
        row.latitude !== null
          ? Number(
              row.latitude,
            )
          : null,

      longitude:
        row.longitude !== null
          ? Number(
              row.longitude,
            )
          : null,

      country: {
        id:
          row.country_id,

        name:
          row.country_name,

        code:
          row.country_code ??
          null,
      },

      placeCount:
        Number(
          row.place_count ??
          0,
        ),

      placesWithMedia:
        Number(
          row.places_with_media ??
          0,
        ),

      image:
        imageAssetId
          ? {
              id:
                imageAssetId,

              url:
                buildAssetUrl({
                  assetId:
                    imageAssetId,

                  storageProvider:
                    row
                      .image_storage_provider,

                  storageKey:
                    row
                      .image_storage_key,

                  isPublic:
                    row
                      .image_is_public ===
                    true,
                }),

              mimeType:
                row
                  .image_mime_type ??
                null,
            }
          : null,
    };
  }

  static toPlace(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    const imageAssetId =
      row.image_asset_id ??
      null;

    return {
      id:
        row.id,

      name:
        row.name,

      description:
        row.description ??
        null,

      address:
        row.address ??
        null,

      postalCode:
        row.postal_code ??
        null,

      latitude:
        row.latitude !== null
          ? Number(
              row.latitude,
            )
          : null,

      longitude:
        row.longitude !== null
          ? Number(
              row.longitude,
            )
          : null,

      rating:
        row.rating !== null
          ? Number(
              row.rating,
            )
          : null,

      reviewCount:
        Number(
          row.review_count ??
          0,
        ),

      recommendedDuration:
        row
          .recommended_duration ??
        null,

      bookingType:
        row.booking_type ??
        null,

      requireTicket:
        row.require_ticket ===
        true,

      itineraryWorthiness:
        row
          .itinerary_worthiness ===
        true,

      distanceKm:
        row.distance_km !==
          null &&
        row.distance_km !==
          undefined
          ? Number(
              Number(
                row.distance_km,
              ).toFixed(
                2,
              ),
            )
          : null,

      city: {
        id:
          row.city_id,

        name:
          row.city_name,

        officialName:
          row
            .city_official_name ??
          null,
      },

      country: {
        id:
          row.country_id,

        name:
          row.country_name,

        code:
          row.country_code ??
          null,
      },

      category:
        row.category_id
          ? {
              id:
                row.category_id,

              name:
                row.category_name ??
                null,
            }
          : null,

      image:
        imageAssetId
          ? {
              id:
                imageAssetId,

              url:
                buildAssetUrl({
                  assetId:
                    imageAssetId,

                  storageProvider:
                    row
                      .image_storage_provider,

                  storageKey:
                    row
                      .image_storage_key,

                  isPublic:
                    row
                      .image_is_public ===
                    true,
                }),

              mimeType:
                row
                  .image_mime_type ??
                null,
            }
          : null,
    };
  }

  static toFeedResponse({
    cityRows,
    placeRows,
    posts,
    includeDiscoveryModules,
    hasMore,
    nextCursor,
  }) {
    const cities =
      (cityRows ?? [])
        .map(
          (row) =>
            this.toCity(
              row,
            ),
        )
        .filter(Boolean);

    const places =
      (placeRows ?? [])
        .map(
          (row) =>
            this.toPlace(
              row,
            ),
        )
        .filter(Boolean);

    const feedItems = [];

    let citiesInserted =
      false;

    let placesInserted =
      false;

    for (
      let index = 0;
      index <
        (posts ?? []).length;
      index += 1
    ) {
      feedItems.push({
        type:
          "POST",

        post:
          posts[index],
      });

      const postPosition =
        index + 1;

      if (
        includeDiscoveryModules &&
        postPosition === 2
      ) {
        feedItems.push({
          type:
            "POPULAR_CITIES",

          title:
            "Popular cities",

          items:
            cities,
        });

        citiesInserted =
          true;
      }

      if (
        includeDiscoveryModules &&
        postPosition === 4
      ) {
        feedItems.push({
          type:
            "NEARBY_PLACES",

          title:
            "Nearby places",

          items:
            places,
        });

        placesInserted =
          true;
      }
    }

    if (
      includeDiscoveryModules &&
      !citiesInserted
    ) {
      feedItems.push({
        type:
          "POPULAR_CITIES",

        title:
          "Popular cities",

        items:
          cities,
      });
    }

    if (
      includeDiscoveryModules &&
      !placesInserted
    ) {
      feedItems.push({
        type:
          "NEARBY_PLACES",

        title:
          "Nearby places",

        items:
          places,
      });
    }

    return {
      items:
        feedItems.map(
          (
            item,
            index,
          ) => ({
            ...item,

            position:
              index + 1,
          }),
        ),

      pagination: {
        hasMore:
          hasMore ===
          true,

        nextCursor:
          nextCursor ??
          null,
      },
    };
  }
}

export default ExploreMapper;
