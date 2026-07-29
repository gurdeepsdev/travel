class PostMapper {
    static toResponse(row) {
      return {
        id: row.id,
        caption: row.caption,
        postType: row.post_type,
        visibility: row.visibility,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
  
        author: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          isVerified: row.is_verified ?? false,
          profilePhoto: row.profile_photo_id
            ? {
                id: row.profile_photo_id,
                storageProvider:
                  row.profile_photo_storage_provider,
                bucket: row.profile_photo_bucket,
                storageKey: row.profile_photo_storage_key,
                mimeType: row.profile_photo_mime_type,
              }
            : null,
        },
  
        assets: Array.isArray(row.assets)
          ? row.assets.map((asset) => ({
              id: asset.id,
              postAssetId: asset.postAssetId,
              displayOrder: Number(asset.displayOrder),
              storageProvider: asset.storageProvider,
              bucket: asset.bucket,
              storageKey: asset.storageKey,
              originalFilename: asset.originalFilename,
              mimeType: asset.mimeType,
              extension: asset.extension,
              fileSize:
                asset.fileSize !== null
                  ? Number(asset.fileSize)
                  : null,
              width:
                asset.width !== null
                  ? Number(asset.width)
                  : null,
              height:
                asset.height !== null
                  ? Number(asset.height)
                  : null,
              durationSeconds:
                asset.durationSeconds !== null
                  ? Number(asset.durationSeconds)
                  : null,
              isPublic: asset.isPublic ?? false,
              createdAt: asset.createdAt,
            }))
          : [],
  
        itineraries: Array.isArray(row.itineraries)
          ? row.itineraries.map((itinerary) => ({
              postItineraryId:
                itinerary.postItineraryId,
              id: itinerary.id,
              createdBy: itinerary.createdBy,
              title: itinerary.title,
              description: itinerary.description,
              startDate: itinerary.startDate,
              endDate: itinerary.endDate,
              durationDays:
                itinerary.durationDays !== null
                  ? Number(itinerary.durationDays)
                  : null,
              budgetAmount:
                itinerary.budgetAmount !== null
                  ? Number(itinerary.budgetAmount)
                  : null,
              currencyCode: itinerary.currencyCode,
              visibility: itinerary.visibility,
              tripStatus: itinerary.tripStatus,
              aiGenerated:
                itinerary.aiGenerated ?? false,
              createdAt: itinerary.createdAt,
              updatedAt: itinerary.updatedAt,
              linkedAt: itinerary.linkedAt,
  
              cover: itinerary.cover
                ? {
                    id: itinerary.cover.id,
                    storageProvider:
                      itinerary.cover.storageProvider,
                    bucket: itinerary.cover.bucket,
                    storageKey:
                      itinerary.cover.storageKey,
                    originalFilename:
                      itinerary.cover.originalFilename,
                    mimeType:
                      itinerary.cover.mimeType,
                    extension:
                      itinerary.cover.extension,
                    fileSize:
                      itinerary.cover.fileSize !== null
                        ? Number(
                            itinerary.cover.fileSize,
                          )
                        : null,
                    width:
                      itinerary.cover.width !== null
                        ? Number(itinerary.cover.width)
                        : null,
                    height:
                      itinerary.cover.height !== null
                        ? Number(itinerary.cover.height)
                        : null,
                    isPublic:
                      itinerary.cover.isPublic ?? false,
                  }
                : null,
            }))
          : [],
  
        place: row.place_id
          ? {
              id: row.place_id,
              name: row.place_name,
              address: row.place_address,
              latitude:
                row.place_latitude !== null
                  ? Number(row.place_latitude)
                  : null,
              longitude:
                row.place_longitude !== null
                  ? Number(row.place_longitude)
                  : null,
              rating:
                row.place_rating !== null
                  ? Number(row.place_rating)
                  : null,
              reviewCount:
                Number(row.place_review_count ?? 0),
  
              city: row.city_id
                ? {
                    id: row.city_id,
                    name: row.city_name,
                    officialName:
                      row.city_official_name,
                  }
                : null,
  
              region: row.region_id
                ? {
                    id: row.region_id,
                    name: row.region_name,
                    officialName:
                      row.region_official_name,
                    timezone: row.region_timezone,
                  }
                : null,
  
              country: row.country_id
                ? {
                    id: row.country_id,
                    name: row.country_name,
                    code: row.country_code,
                    phonePrefix:
                      row.country_phone_prefix,
                    timezone: row.country_timezone,
                  }
                : null,
            }
          : null,
  
          engagement: {
            likes: Number(row.like_count ?? 0),
            comments: Number(row.comment_count ?? 0),
            shares: Number(row.share_count ?? 0),
            views: Number(row.view_count ?? 0),
          },
          
          viewerState: {
            liked: row.viewer_liked ?? false,
            beenThere: row.viewer_been_there ?? false,
            isOwner: row.viewer_is_owner ?? false,
            isReshared: row.viewer_reshared ?? false,
          },
      };
    }
  
    static toResponseList(rows) {
      return rows.map((row) => this.toResponse(row));
    }
  }
  
  export default PostMapper;