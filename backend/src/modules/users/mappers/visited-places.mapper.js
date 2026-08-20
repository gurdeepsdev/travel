import {
  buildAssetUrl,
} from "../utils/asset-url.util.js";

class VisitedPlacesMapper {
  static toCityVerificationResponse({
    row,
    asset,
    verificationDetails,
  }) {
    if (!row?.id) {
      return null;
    }

    return {
      visitCreated: true,
      verification: {
        status: "VERIFIED",
        confidence:
          verificationDetails?.confidence ??
          null,
        method:
          verificationDetails
            ?.verificationMethod ??
          null,
        distanceMeters:
          verificationDetails
            ?.distanceMeters ??
          null,
        radiusMeters:
          verificationDetails
            ?.radiusMeters ??
          null,
      },
      visitedPlace: null,
      cityCollection: {
        id: row.id,
        cityId: row.city_id,
        name: row.city_name ?? null,
        verificationStatus: true,
        visitedAt: row.visited_at ?? null,
        isPreference:
          row.is_preference === true,
        iconAssetId:
          row.icon_asset_id ?? null,
        evidence: {
          assetId:
            row.verification_asset_id ??
            asset?.id ??
            null,
          url: buildAssetUrl({
            assetId:
              asset?.id ??
              row.verification_asset_id ??
              null,
            storageProvider:
              asset?.storage_provider ?? null,
            storageKey:
              asset?.storage_key ?? null,
            isPublic:
              asset?.is_public === true,
          }),
        },
      },
    };
  }

  static toVerificationResponse({
    row,
    asset,
  }) {
    if (!row?.id) {
      return null;
    }

    const details =
      row.verification_details &&
      typeof row.verification_details ===
        "object"
        ? row.verification_details
        : {};

    const isPublic =
      asset?.is_public ===
        true;

    return {
      visitCreated:
        row.visit_created ===
          true,

      verification: {
        status:
          row.verification_status,

        confidence:
          details.confidence ??
          null,

        method:
          details
            .verificationMethod ??
          null,

        distanceMeters:
          details.distanceMeters ??
          null,

        radiusMeters:
          details.radiusMeters ??
          null,
      },

      visitedPlace: {
        id:
          row.id,

        visitedAt:
          row.visited_at,

        claimedVisitedAt:
          row.claimed_visited_at ??
          null,

        evidenceCapturedAt:
          row.evidence_captured_at ??
          null,

        visitSource:
          row.visit_source,

        place: {
          id:
            row.place_id,

          name:
            row.place_name ??
            null,
        },

        city: {
          id:
            row.city_id,

          name:
            row.city_name ??
            null,

          officialName:
            row.city_official_name ??
            null,

          country: {
            id:
              row.country_id ??
              null,

            name:
              row.country_name ??
              null,
          },
        },

        evidence: {
          assetId:
            row.verification_asset_id ??
            null,

          originalFilename:
            asset
              ?.original_filename ??
            null,

          mimeType:
            asset?.mime_type ??
            null,

          extension:
            asset?.extension ??
            null,

          fileSize:
            asset?.file_size ===
              null ||
            asset?.file_size ===
              undefined
              ? null
              : Number(
                  asset.file_size,
                ),

          isPublic,

          url:
            buildAssetUrl({
              assetId:
                asset?.id ??
                row
                  .verification_asset_id ??
                null,

              storageProvider:
                asset
                  ?.storage_provider ??
                null,

              storageKey:
                asset
                  ?.storage_key ??
                null,

              isPublic,
            }),
        },
      },

      cityCollection: {
        id:
          row.collection_id,

        cityId:
          row.city_id,

        name:
          row.city_name ??
          null,

        verificationStatus:
          row.collection_verified ===
            true,

        visitedAt:
          row.collection_visited_at ??
          null,

        isPreference:
          row.is_preference ===
            true,

        iconAssetId:
          row.icon_asset_id ??
          null,
      },
    };
  }


    static toPreferenceResponse(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    const iconIsPublic =
      row.icon_is_public ===
        true;

    return {
      collection: {
        id:
          row.id,

        verificationStatus:
          row.verification_status ===
            true,

        visitedAt:
          row.visited_at ??
          null,

        isPreference:
          row.is_preference ===
            true,

        city: {
          id:
            row.city_id,

          name:
            row.city_name ??
            row.collections_name ??
            null,

          officialName:
            row.city_official_name ??
            null,

          country: {
            id:
              row.country_id ??
              null,

            name:
              row.country_name ??
              null,
          },

          icon:
            row.icon_asset_id
              ? {
                  id:
                    row.icon_asset_id,

                  url:
                    buildAssetUrl({
                      assetId:
                        row.icon_asset_id,

                      storageProvider:
                        row
                          .icon_storage_provider ??
                        null,

                      storageKey:
                        row
                          .icon_storage_key ??
                        null,

                      isPublic:
                        iconIsPublic,
                    }),

                  mimeType:
                    row.icon_mime_type ??
                    null,
                }
              : null,
        },
      },
    };
  }

    static toVisitedPlaceItem(
    row,
  ) {
    if (!row?.id) {
      return null;
    }

    const iconIsPublic =
      row.icon_is_public ===
        true;

    return {
      id:
        row.id,

      visitedAt:
        row.visited_at,

      claimedVisitedAt:
        row.claimed_visited_at ??
        null,

      evidenceCapturedAt:
        row.evidence_captured_at ??
        null,

      verificationStatus:
        row.verification_status,

      visitSource:
        row.visit_source,

      place: {
        id:
          row.place_id,

        name:
          row.place_name ??
          null,

        location: {
          latitude:
            row.place_latitude ===
              null ||
            row.place_latitude ===
              undefined
              ? null
              : Number(
                  row.place_latitude,
                ),

          longitude:
            row.place_longitude ===
              null ||
            row.place_longitude ===
              undefined
              ? null
              : Number(
                  row.place_longitude,
                ),
        },
      },

      cityCollection: {
        id:
          row.collection_id,

        verificationStatus:
          row.collection_verified ===
            true,

        isPreference:
          row.is_preference ===
            true,
      },

      city: {
        id:
          row.city_id,

        name:
          row.city_name ??
          null,

        officialName:
          row.city_official_name ??
          null,

        country: {
          id:
            row.country_id ??
            null,

          name:
            row.country_name ??
            null,
        },

        icon:
          row.icon_asset_id
            ? {
                id:
                  row.icon_asset_id,

                url:
                  buildAssetUrl({
                    assetId:
                      row.icon_asset_id,

                    storageProvider:
                      row
                        .icon_storage_provider ??
                      null,

                    storageKey:
                      row
                        .icon_storage_key ??
                      null,

                    isPublic:
                      iconIsPublic,
                  }),

                mimeType:
                  row.icon_mime_type ??
                  null,
              }
            : null,
      },
    };
  }

  static toVisitedPlacesListResponse({
    rows,
    hasMore,
    nextCursor,
  }) {
    return {
      visitedPlaces:
        (rows ?? [])
          .map((row) =>
            this.toVisitedPlaceItem(
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
}

export default
  VisitedPlacesMapper;
