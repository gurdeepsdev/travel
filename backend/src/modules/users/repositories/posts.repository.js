import Database from "../../../database/database-manager.js";
import PostMapper from "../mappers/post.mapper.js";

class PostsRepository {
  async getMyPosts({
    userId,
    limit,
    cursor = null,
  }) {
    const params = [
        targetUserId,
        viewerUserId,
      ];
          let cursorWhere = "";

    if (cursor) {
      params.push(cursor.createdAt);
      params.push(cursor.id);

      cursorWhere = `
        AND (p.created_at, p.id) < ($2::timestamp, $3::uuid)
      `;
    }

    params.push(limit + 1);

    const limitIndex = params.length;

    const sql = `
      SELECT
        p.id,
        p.user_id,
        p.caption,
        p.post_type,
        p.visibility,
        p.place_id,
        p.comment_count,
        p.share_count,
        p.view_count,
        p.created_at,
        p.updated_at,

        up.username,
        up.display_name,
        up.is_verified,

        profile_photo.id AS profile_photo_id,
        profile_photo.storage_provider
          AS profile_photo_storage_provider,
        profile_photo.bucket
          AS profile_photo_bucket,
        profile_photo.storage_key
          AS profile_photo_storage_key,
        profile_photo.mime_type
          AS profile_photo_mime_type,

        place.id AS place_id,
        place.name AS place_name,
        place.address AS place_address,
        place.latitude AS place_latitude,
        place.longitude AS place_longitude,
        place.rating AS place_rating,
        place.review_count AS place_review_count,

        city.id AS city_id,
        city.name AS city_name,
        city.official_name AS city_official_name,

        region.id AS region_id,
        region.name AS region_name,
        region.official_name AS region_official_name,
        region.timezone AS region_timezone,

        country.id AS country_id,
        country.name AS country_name,
        country.code AS country_code,
        country.phone_prefix AS country_phone_prefix,
        country.timezone AS country_timezone,

     COALESCE(
  post_itinerary_data.itineraries,
  '[]'::jsonb
) AS itineraries,

COALESCE(
  engagement_data.like_count,
  0
) AS like_count,

COALESCE(
  engagement_data.viewer_liked,
  false
) AS viewer_liked,

COALESCE(
  engagement_data.viewer_been_there,
  false
) AS viewer_been_there,

COALESCE(
  engagement_data.viewer_reshared,
  false
) AS viewer_reshared,

(p.user_id = $1) AS viewer_is_owner

      FROM explore.posts p

      LEFT JOIN users.profiles up
        ON up.user_id = p.user_id
        AND up.deleted_at IS NULL

      LEFT JOIN media.assets profile_photo
        ON profile_photo.id = up.profile_photo_asset_id
        AND profile_photo.deleted_at IS NULL

      LEFT JOIN poi.places place
        ON place.id = p.place_id

      LEFT JOIN poi.cities city
        ON city.id = place.city_id

      LEFT JOIN poi.regions region
        ON region.id = place.region_id

      LEFT JOIN poi.countries country
        ON country.id = place.country_id

   LEFT JOIN LATERAL (
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', asset.id,
          'postAssetId', post_asset.id,
          'displayOrder', post_asset.display_order,
          'storageProvider', asset.storage_provider,
          'bucket', asset.bucket,
          'storageKey', asset.storage_key,
          'originalFilename', asset.original_filename,
          'mimeType', asset.mime_type,
          'extension', asset.extension,
          'fileSize', asset.file_size,
          'width', asset.original_width,
          'height', asset.original_height,
          'durationSeconds', asset.duration_seconds,
          'isPublic', asset.is_public,
          'createdAt', asset.created_at
        )
        ORDER BY post_asset.display_order ASC
      ) FILTER (
        WHERE asset.id IS NOT NULL
      ),
      '[]'::jsonb
    ) AS assets

  FROM explore.post_assets AS post_asset

  INNER JOIN media.assets AS asset
    ON asset.id = post_asset.asset_id
   AND asset.deleted_at IS NULL

  WHERE post_asset.post_id = post.id
) AS asset_stats
  ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'postItineraryId', post_itinerary.id,
              'id', itinerary_data.id,
              'createdBy', itinerary_data.created_by,
              'title', itinerary_data.title,
              'description', itinerary_data.description,
              'startDate', itinerary_data.start_date,
              'endDate', itinerary_data.end_date,
              'durationDays', itinerary_data.duration_days,
              'budgetAmount', itinerary_data.budget_amount,
              'currencyCode', itinerary_data.currency_code,
              'visibility', itinerary_data.visibility,
              'tripStatus', itinerary_data.trip_status,
              'aiGenerated', itinerary_data.ai_generated,
              'createdAt', itinerary_data.created_at,
              'updatedAt', itinerary_data.updated_at,
              'linkedAt', post_itinerary.created_at,
              'cover', CASE
                WHEN itinerary_cover.id IS NOT NULL
                THEN jsonb_build_object(
                  'id', itinerary_cover.id,
                  'storageProvider',
                    itinerary_cover.storage_provider,
                  'bucket', itinerary_cover.bucket,
                  'storageKey', itinerary_cover.storage_key,
                  'originalFilename',
                    itinerary_cover.original_filename,
                  'mimeType', itinerary_cover.mime_type,
                  'extension', itinerary_cover.extension,
                  'fileSize', itinerary_cover.file_size,
                  'width', itinerary_cover.original_width,
                  'height', itinerary_cover.original_height,
                  'isPublic', itinerary_cover.is_public
                )
                ELSE NULL
              END
            )
            ORDER BY post_itinerary.created_at ASC
          ) AS itineraries

        FROM explore.post_itineraries post_itinerary

        INNER JOIN itinerary.itineraries itinerary_data
          ON itinerary_data.id = post_itinerary.itinerary_id
          AND itinerary_data.deleted_at IS NULL

        LEFT JOIN media.assets itinerary_cover
          ON itinerary_cover.id = itinerary_data.cover_asset_id
          AND itinerary_cover.deleted_at IS NULL

        WHERE post_itinerary.post_id = p.id
      ) post_itinerary_data
        ON TRUE

        LEFT JOIN LATERAL (
  SELECT
    (
      SELECT COUNT(*)
      FROM explore.post_likes post_like
      WHERE post_like.post_id = p.id
    ) AS like_count,

    EXISTS (
      SELECT 1
      FROM explore.post_likes viewer_like
      WHERE viewer_like.post_id = p.id
        AND viewer_like.user_id = $1
    ) AS viewer_liked,

    EXISTS (
      SELECT 1
      FROM explore.post_been_there viewer_been_there
      WHERE viewer_been_there.post_id = p.id
        AND viewer_been_there.user_id = $1
    ) AS viewer_been_there,

    EXISTS (
      SELECT 1
      FROM explore.post_reshare viewer_reshare
      WHERE viewer_reshare.shared_post_id = p.id
        AND viewer_reshare.user_id = $1
    ) AS viewer_reshared
) engagement_data
  ON TRUE

      WHERE p.user_id = $1
      ${cursorWhere}

      ORDER BY
        p.created_at DESC,
        p.id DESC

      LIMIT $${limitIndex}
    `;

    const { rows } = await Database.query(sql, params);

    const hasMore = rows.length > limit;

    const paginatedRows = hasMore
      ? rows.slice(0, limit)
      : rows;

    const lastPost = paginatedRows.at(-1);

    const posts = PostMapper.toResponseList(paginatedRows);

    return {
      rows: posts,
      hasMore,
      nextCursor:
        hasMore && lastPost
          ? {
              createdAt: lastPost.created_at,
              id: lastPost.id,
            }
          : null,
    };
  }
/**
 * Fetches posts displayed on another user's profile.
 *
 * Visibility rules:
 * - Owner can see all their own posts.
 * - Other viewers can see PUBLIC posts only.
 * - Anonymous viewers can see PUBLIC posts only.
 *
 * @param {object} params
 * @param {string} params.targetUserId
 * @param {string|null} params.viewerUserId
 * @param {number} params.limit
 * @param {string|null} params.cursor
 * @returns {Promise<{
*   rows: object[],
*   hasMore: boolean,
*   nextCursor: string|null
* }>}
*/
async getUserPosts({
 targetUserId,
 viewerUserId = null,
 limit = 20,
 cursor = null,
}) {
 const safeLimit = Math.min(
   Math.max(Number(limit) || 20, 1),
   50,
 );

 const normalizedViewerUserId =
   viewerUserId || null;

 const params = [
   targetUserId,
   normalizedViewerUserId,
 ];

 let cursorCondition = "";

 if (cursor) {
   params.push(cursor);

   cursorCondition = `
     AND post.created_at < $${params.length}::timestamptz
   `;
 }

 params.push(safeLimit + 1);

 const limitParameter = `$${params.length}`;

 const query = `
   SELECT
     post.id,
     post.user_id,
     post.caption,
     post.post_type,
     post.visibility,
     post.created_at,
     post.updated_at,

     profile.username,
     profile.display_name,
     profile.is_verified,

   profile_photo.id
  AS profile_photo_id,

profile_photo.storage_provider
  AS profile_photo_storage_provider,

profile_photo.bucket
  AS profile_photo_bucket,

profile_photo.storage_key
  AS profile_photo_storage_key,

profile_photo.mime_type
  AS profile_photo_mime_type,

profile_photo.original_filename
  AS profile_photo_original_filename,

profile_photo.extension
  AS profile_photo_extension,

profile_photo.file_size
  AS profile_photo_file_size,

profile_photo.original_width
  AS profile_photo_original_width,

profile_photo.original_height
  AS profile_photo_original_height,

     place.id
       AS place_id,

     place.name
       AS place_name,

     place.address
       AS place_address,

     place.latitude
       AS place_latitude,

     place.longitude
       AS place_longitude,

     place.rating
       AS place_rating,

     place.review_count
       AS place_review_count,

     city.id
       AS city_id,

     city.name
       AS city_name,

     city.official_name
       AS city_official_name,

     region.id
       AS region_id,

     region.name
       AS region_name,

     region.official_name
       AS region_official_name,

     region.timezone
       AS region_timezone,

     country.id
       AS country_id,

     country.name
       AS country_name,

     country.code
       AS country_code,

     country.phone_prefix
       AS country_phone_prefix,

     country.timezone
       AS country_timezone,

     COALESCE(
       asset_stats.assets,
       '[]'::jsonb
     ) AS assets,

     COALESCE(
       itinerary_stats.itineraries,
       '[]'::jsonb
     ) AS itineraries,

     0::integer AS likes_count,
     0::integer AS comments_count,
     0::integer AS shares_count,
     0::integer AS views_count,

     FALSE AS viewer_liked,
     FALSE AS viewer_been_there,
     FALSE AS viewer_is_reshared,

     CASE
       WHEN $2::uuid IS NOT NULL
        AND $2::uuid = post.user_id
       THEN TRUE
       ELSE FALSE
     END AS viewer_is_owner

   FROM explore.posts AS post

   INNER JOIN users.profiles AS profile
     ON profile.user_id = post.user_id
    AND profile.deleted_at IS NULL

   LEFT JOIN media.assets AS profile_photo
     ON profile_photo.id =
       profile.profile_photo_asset_id
    AND profile_photo.deleted_at IS NULL

   LEFT JOIN poi.places AS place
     ON place.id = post.place_id

   LEFT JOIN poi.cities AS city
     ON city.id = place.city_id

   LEFT JOIN poi.regions AS region
     ON region.id = city.region_id

   LEFT JOIN poi.countries AS country
     ON country.id = city.country_id

   LEFT JOIN LATERAL
   (
     SELECT
       COALESCE(
         JSONB_AGG(
           JSONB_BUILD_OBJECT(
             'id',
               asset.id,

            'mimeType',
asset.mime_type,

             'storageKey',
               asset.storage_key,

           
'originalFilename',
asset.original_filename,

             'extension',
               asset.extension,

             'fileSize',
               asset.file_size,

             'width',
               asset.original_width,

             'height',
               asset.original_height,

            'displayOrder',
post_asset.display_order
           )
           ORDER BY
 post_asset.display_order ASC
         ) FILTER (
           WHERE asset.id IS NOT NULL
         ),
         '[]'::jsonb
       ) AS assets

     FROM explore.post_assets AS post_asset

     INNER JOIN media.assets AS asset
       ON asset.id = post_asset.asset_id
      AND asset.deleted_at IS NULL

     WHERE post_asset.post_id = post.id
   ) AS asset_stats
     ON TRUE

   LEFT JOIN LATERAL
   (
     SELECT
       COALESCE(
         JSONB_AGG(
           JSONB_BUILD_OBJECT(
  'id',
    itinerary.id,

  'title',
    itinerary.title,

  'tripStatus',
    itinerary.trip_status
)
           ORDER BY
             itinerary.created_at DESC
         ) FILTER (
           WHERE itinerary.id IS NOT NULL
         ),
         '[]'::jsonb
       ) AS itineraries

     FROM explore.post_itineraries
       AS post_itinerary

     INNER JOIN itinerary.itineraries
       AS itinerary
       ON itinerary.id =
         post_itinerary.itinerary_id

     WHERE post_itinerary.post_id = post.id
   ) AS itinerary_stats
     ON TRUE

   WHERE post.user_id = $1

     AND (
       $2::uuid = post.user_id
       OR post.visibility = 'PUBLIC'
     )

     ${cursorCondition}

   ORDER BY
     post.created_at DESC,
     post.id DESC

   LIMIT ${limitParameter}
 `;

 const { rows } = await Database.query(
    query,
    params,
  );

 const hasMore =
   rows.length > safeLimit;

 const resultRows = hasMore
   ? rows.slice(0, safeLimit)
   : rows;

 const lastPost =
   resultRows[resultRows.length - 1] ?? null;

 return {
   rows: resultRows,
   hasMore,
   nextCursor:
     hasMore && lastPost
       ? lastPost.created_at
       : null,
 };
}

}

export default new PostsRepository();