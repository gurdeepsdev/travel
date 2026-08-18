// class PostMapper {
//     static toResponse(row) {
//       return {
//         id: row.id,
//         caption: row.caption,
//         postType: row.post_type,
//         visibility: row.visibility,
//         createdAt: row.created_at,
//         updatedAt: row.updated_at,
  
//         author: {
//           id: row.user_id,
//           username: row.username,
//           displayName: row.display_name,
//           isVerified: row.is_verified ?? false,
//           profilePhoto: row.profile_photo_id
//             ? {
//                 id: row.profile_photo_id,
//                 storageProvider:
//                   row.profile_photo_storage_provider,
//                 bucket: row.profile_photo_bucket,
//                 storageKey: row.profile_photo_storage_key,
//                 mimeType: row.profile_photo_mime_type,
//               }
//             : null,
//         },
  
//         assets: Array.isArray(row.assets)
//           ? row.assets.map((asset) => ({
//               id: asset.id,
//               postAssetId: asset.postAssetId,
//               displayOrder: Number(asset.displayOrder),
//               storageProvider: asset.storageProvider,
//               bucket: asset.bucket,
//               storageKey: asset.storageKey,
//               originalFilename: asset.originalFilename,
//               mimeType: asset.mimeType,
//               extension: asset.extension,
//               fileSize:
//                 asset.fileSize !== null
//                   ? Number(asset.fileSize)
//                   : null,
//               width:
//                 asset.width !== null
//                   ? Number(asset.width)
//                   : null,
//               height:
//                 asset.height !== null
//                   ? Number(asset.height)
//                   : null,
//               durationSeconds:
//                 asset.durationSeconds !== null
//                   ? Number(asset.durationSeconds)
//                   : null,
//               isPublic: asset.isPublic ?? false,
//               createdAt: asset.createdAt,
//             }))
//           : [],
  
//         itineraries: Array.isArray(row.itineraries)
//           ? row.itineraries.map((itinerary) => ({
//               postItineraryId:
//                 itinerary.postItineraryId,
//               id: itinerary.id,
//               createdBy: itinerary.createdBy,
//               title: itinerary.title,
//               description: itinerary.description,
//               startDate: itinerary.startDate,
//               endDate: itinerary.endDate,
//               durationDays:
//                 itinerary.durationDays !== null
//                   ? Number(itinerary.durationDays)
//                   : null,
//               budgetAmount:
//                 itinerary.budgetAmount !== null
//                   ? Number(itinerary.budgetAmount)
//                   : null,
//               currencyCode: itinerary.currencyCode,
//               visibility: itinerary.visibility,
//               tripStatus: itinerary.tripStatus,
//               aiGenerated:
//                 itinerary.aiGenerated ?? false,
//               createdAt: itinerary.createdAt,
//               updatedAt: itinerary.updatedAt,
//               linkedAt: itinerary.linkedAt,
  
//               cover: itinerary.cover
//                 ? {
//                     id: itinerary.cover.id,
//                     storageProvider:
//                       itinerary.cover.storageProvider,
//                     bucket: itinerary.cover.bucket,
//                     storageKey:
//                       itinerary.cover.storageKey,
//                     originalFilename:
//                       itinerary.cover.originalFilename,
//                     mimeType:
//                       itinerary.cover.mimeType,
//                     extension:
//                       itinerary.cover.extension,
//                     fileSize:
//                       itinerary.cover.fileSize !== null
//                         ? Number(
//                             itinerary.cover.fileSize,
//                           )
//                         : null,
//                     width:
//                       itinerary.cover.width !== null
//                         ? Number(itinerary.cover.width)
//                         : null,
//                     height:
//                       itinerary.cover.height !== null
//                         ? Number(itinerary.cover.height)
//                         : null,
//                     isPublic:
//                       itinerary.cover.isPublic ?? false,
//                   }
//                 : null,
//             }))
//           : [],
  
//         place: row.place_id
//           ? {
//               id: row.place_id,
//               name: row.place_name,
//               address: row.place_address,
//               latitude:
//                 row.place_latitude !== null
//                   ? Number(row.place_latitude)
//                   : null,
//               longitude:
//                 row.place_longitude !== null
//                   ? Number(row.place_longitude)
//                   : null,
//               rating:
//                 row.place_rating !== null
//                   ? Number(row.place_rating)
//                   : null,
//               reviewCount:
//                 Number(row.place_review_count ?? 0),
  
//               city: row.city_id
//                 ? {
//                     id: row.city_id,
//                     name: row.city_name,
//                     officialName:
//                       row.city_official_name,
//                   }
//                 : null,
  
//               region: row.region_id
//                 ? {
//                     id: row.region_id,
//                     name: row.region_name,
//                     officialName:
//                       row.region_official_name,
//                     timezone: row.region_timezone,
//                   }
//                 : null,
  
//               country: row.country_id
//                 ? {
//                     id: row.country_id,
//                     name: row.country_name,
//                     code: row.country_code,
//                     phonePrefix:
//                       row.country_phone_prefix,
//                     timezone: row.country_timezone,
//                   }
//                 : null,
//             }
//           : null,
  
//           engagement: {
//             likes: Number(row.like_count ?? 0),
//             comments: Number(row.comment_count ?? 0),
//             shares: Number(row.share_count ?? 0),
//             views: Number(row.view_count ?? 0),
//           },
          
//           viewerState: {
//             liked: row.viewer_liked ?? false,
//             beenThere: row.viewer_been_there ?? false,
//             isOwner: row.viewer_is_owner ?? false,
//             isReshared: row.viewer_reshared ?? false,
//           },
//       };
//     }
  
//     static toResponseList(rows) {
//       return rows.map((row) => this.toResponse(row));
//     }
//   }
  
//   export default PostMapper;



import {
    buildAssetUrl,
  } from "../utils/asset-url.util.js";
  
  class PostMapper {
    static mapAsset(asset) {
      if (!asset) {
        return null;
      }
  
      const mimeType =
        typeof asset.mimeType === "string"
          ? asset.mimeType
          : null;
  
      let mediaType = null;
  
      if (mimeType?.startsWith("image/")) {
        mediaType = "img";
      } else if (mimeType?.startsWith("video/")) {
        mediaType = "video";
      } else if (mimeType) {
        mediaType = "file";
      }
  
      return {
        id: asset.id ?? null,
  
        postAssetId:
          asset.postAssetId ?? null,
  
        displayOrder:
          asset.displayOrder !== null &&
          asset.displayOrder !== undefined
            ? Number(asset.displayOrder)
            : null,
  
        mediaType,
  
        storageProvider:
          asset.storageProvider ?? null,
  
        bucket:
          asset.bucket ?? null,
  
        storageKey:
          asset.storageKey ?? null,
  
      url: buildAssetUrl({
          assetId:
            asset.id,

          storageProvider:
            asset.storageProvider,

          storageKey:
            asset.storageKey,

          isPublic:
            asset.isPublic ===
            true,
        }),
        originalFilename:
          asset.originalFilename ?? null,
  
        mimeType,
  
        extension:
          asset.extension ?? null,
  
        fileSize:
          asset.fileSize !== null &&
          asset.fileSize !== undefined
            ? Number(asset.fileSize)
            : null,
  
        width:
          asset.width !== null &&
          asset.width !== undefined
            ? Number(asset.width)
            : null,
  
        height:
          asset.height !== null &&
          asset.height !== undefined
            ? Number(asset.height)
            : null,
  
        durationSeconds:
          asset.durationSeconds !== null &&
          asset.durationSeconds !== undefined
            ? Number(asset.durationSeconds)
            : null,
  
        isPublic:
          asset.isPublic ?? false,
  
        createdAt:
          asset.createdAt ?? null,
      };
    }
  
    static mapItinerary(itinerary) {
      return {
        postItineraryId:
          itinerary.postItineraryId ?? null,
  
        id:
          itinerary.id ?? null,
  
        createdBy:
          itinerary.createdBy ?? null,
  
        title:
          itinerary.title ?? null,
  
        description:
          itinerary.description ?? null,
  
        startDate:
          itinerary.startDate ?? null,
  
        endDate:
          itinerary.endDate ?? null,
  
        durationDays:
          itinerary.durationDays !== null &&
          itinerary.durationDays !== undefined
            ? Number(itinerary.durationDays)
            : null,
  
        budgetAmount:
          itinerary.budgetAmount !== null &&
          itinerary.budgetAmount !== undefined
            ? Number(itinerary.budgetAmount)
            : null,
  
        currencyCode:
          itinerary.currencyCode ?? null,
  
        visibility:
          itinerary.visibility ?? null,
  
        tripStatus:
          itinerary.tripStatus ?? null,
  
        aiGenerated:
          itinerary.aiGenerated ?? false,
  
        createdAt:
          itinerary.createdAt ?? null,
  
        updatedAt:
          itinerary.updatedAt ?? null,
  
        linkedAt:
          itinerary.linkedAt ?? null,
          
          metadata: itinerary.metadata ?? null,
  
        cover: itinerary.cover
          ? {
              ...this.mapAsset(
                itinerary.cover,
              ),
              postAssetId: undefined,
              displayOrder: undefined,
            }
          : null,
      };
    }
  
    static toResponse(row) {
      const assets =
        Array.isArray(row.assets)
          ? row.assets
              .map((asset) =>
                this.mapAsset(asset),
              )
              .filter(Boolean)
          : [];
  
      const itineraries =
        Array.isArray(row.itineraries)
          ? row.itineraries.map(
              (itinerary) =>
                this.mapItinerary(
                  itinerary,
                ),
            )
          : [];
  
      return {
        id: row.id,
  
        caption:
          row.caption ?? null,
  
        postType:
          row.post_type ?? null,
  
        visibility:
          row.visibility ?? null,
  
        createdAt:
          row.created_at ?? null,
  
        updatedAt:
          row.updated_at ?? null,
  
        author: {
          id:
            row.user_id,
  
          username:
            row.username ?? null,
  
          displayName:
            row.display_name ?? null,
  
          isVerified:
            row.is_verified ?? false,
  
                   profilePhoto:
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

                  url:
                    buildAssetUrl({
                      assetId:
                        row.profile_photo_id,

                      storageProvider:
                        row.profile_photo_storage_provider ??
                        null,

                      storageKey:
                        row.profile_photo_storage_key ??
                        null,

                      isPublic:
                        row.profile_photo_is_public ===
                        true,
                    }),

                  mimeType:
                    row.profile_photo_mime_type ??
                    null,
                }
              : null,
        },

        assets,
  
        coverAsset:
          assets.length > 0
            ? assets[0]
            : null,
  
        itineraries,
  
        place: row.place_id
          ? {
              id:
                row.place_id,
  
              name:
                row.place_name ?? null,
  
              address:
                row.place_address ?? null,
  
              latitude:
                row.place_latitude !== null &&
                row.place_latitude !==
                  undefined
                  ? Number(
                      row.place_latitude,
                    )
                  : null,
  
              longitude:
                row.place_longitude !== null &&
                row.place_longitude !==
                  undefined
                  ? Number(
                      row.place_longitude,
                    )
                  : null,
  
              rating:
                row.place_rating !== null &&
                row.place_rating !==
                  undefined
                  ? Number(
                      row.place_rating,
                    )
                  : null,
  
              reviewCount:
                Number(
                  row.place_review_count ??
                    0,
                ),
  
              city: row.city_id
                ? {
                    id:
                      row.city_id,
  
                    name:
                      row.city_name ??
                      null,
  
                    officialName:
                      row.city_official_name ??
                      null,
                  }
                : null,
  
              region: row.region_id
                ? {
                    id:
                      row.region_id,
  
                    name:
                      row.region_name ??
                      null,
  
                    officialName:
                      row.region_official_name ??
                      null,
  
                    timezone:
                      row.region_timezone ??
                      null,
                  }
                : null,
  
              country: row.country_id
                ? {
                    id:
                      row.country_id,
  
                    name:
                      row.country_name ??
                      null,
  
                    code:
                      row.country_code ??
                      null,
  
                    phonePrefix:
                      row.country_phone_prefix ??
                      null,
  
                    timezone:
                      row.country_timezone ??
                      null,
                  }
                : null,
            }
          : null,
  
        engagement: {
          likes:
            Number(
              row.like_count ?? 0,
            ),
  
          comments:
            Number(
              row.comment_count ?? 0,
            ),
  
          shares:
            Number(
              row.share_count ?? 0,
            ),
  
          views:
            Number(
              row.view_count ?? 0,
            ),
  
          beenThere:
            Number(
              row.been_there_count ?? 0,
            ),
        },
  
        viewerState: {
          liked:
            row.viewer_liked ??
            false,
  
          saved:
            row.viewer_saved ??
            false,
  
          beenThere:
            row.viewer_been_there ??
            false,
  
          reshared:
            row.viewer_reshared ??
            false,
  
          isOwner:
            row.viewer_is_owner ??
            false,
        },
  
        repost: row.repost_id
          ? {
              id:
                row.repost_id,
  
              message:
                row.repost_message ??
                null,
  
              originalPostId:
                row.repost_original_post_id,
  
              createdAt:
                row.repost_created_at ??
                null,
            }
          : null,
  
        /*
         * Your live database currently has no
         * explore post-tagged-users table.
         */
        taggedPeople:
          Array.isArray(
            row.tagged_people,
          )
            ? row.tagged_people
            : [],
      };
    }
  
    static toResponseList(rows) {
      return rows.map((row) =>
        this.toResponse(row),
      );
    }
  }
  
  export default PostMapper;