// // cat > src/modules/users/repositories/profiles.repository.js <<'EOF'
// import BaseRepository from "../../../database/repositories/base.repository.js";

// const PROFILE_IMAGE_VARIANT_PRIORITY = Object.freeze({
//   THUMBNAIL: 1,
//   SMALL: 2,
//   MEDIUM: 3,
//   LARGE: 4,
//   ORIGINAL: 5,
//   CUSTOM: 6,
// });

// const PROFILE_IMAGE_FORMAT_PRIORITY = Object.freeze({
//   AVIF: 1,
//   WEBP: 2,
//   JPG: 3,
//   JPEG: 4,
//   PNG: 5,
// });

// class ProfilesRepository extends BaseRepository {
//   constructor() {
//     super("users", "profiles");
//   }

//   async create({
//     userId,
//     username,
//     displayName = null,
//     bio = null,
//     profilePhotoAssetId = null,
//     coverPhotoAssetId = null,
//     countryId = null,
//     cityId = null,
//     socialLinks = {},
//   }) {
//     const query = `
//             INSERT INTO ${this.fullTableName}
//             (
//                 user_id,
//                 username,
//                 display_name,
//                 bio,
//                 profile_photo_asset_id,
//                 cover_photo_asset_id,
//                 country_id,
//                 city_id,
//                 social_links
//             )
//             VALUES
//             (
//                 $1,
//                 $2,
//                 $3,
//                 $4,
//                 $5,
//                 $6,
//                 $7,
//                 $8,
//                 $9::jsonb
//             )
//             RETURNING
//                 user_id,
//                 username,
//                 display_name,
//                 bio,
//                 profile_photo_asset_id,
//                 cover_photo_asset_id,
//                 country_id,
//                 city_id,
//                 social_links,
//                 is_verified,
//                 profile_completed_at,
//                 created_at,
//                 updated_at
//         `;

//     const params = [
//       userId,
//       username,
//       displayName,
//       bio,
//       profilePhotoAssetId,
//       coverPhotoAssetId,
//       countryId,
//       cityId,
//       JSON.stringify(socialLinks),
//     ];

//     const { rows } = await this.query(query, params);

//     return rows[0] ?? null;
//   }

//   /**
//    * Fetches the authenticated user's complete profile in one database
//    * round trip.
//    *
//    * Includes:
//    * - Profile information
//    * - Country and city
//    * - Original asset metadata
//    * - Preferred image variant
//    * - User-specific counters
//    *
//    * @param {string} userId
//    * @returns {Promise<object|null>}
//    */
//   async findByUserId(userId) {
//     const query = `
//             SELECT
//                 profile.user_id,
//                 profile.username,
//                 profile.display_name,
//                 profile.bio,
//                 profile.social_links,
//                 profile.is_verified,
//                 profile.profile_completed_at,
//                 profile.created_at,
//                 profile.updated_at,

//                 country.id AS country_id,
//                 country.name AS country_name,
//                 country.code AS country_code,
//                 country.is_active AS country_is_active,

//                 city.id AS city_id,
//                 city.name AS city_name,
//                 city.official_name AS city_official_name,
//                 city.country_id AS city_country_id,
//                 city.is_active AS city_is_active,

//                 profile_photo.id AS profile_photo_asset_id,
//                 profile_photo.storage_provider
//                     AS profile_photo_storage_provider,
//                 profile_photo.bucket
//                     AS profile_photo_bucket,
//                 profile_photo.storage_key
//                     AS profile_photo_original_storage_key,
//                 profile_photo.mime_type
//                     AS profile_photo_mime_type,
//                 profile_photo.original_width
//                     AS profile_photo_original_width,
//                 profile_photo.original_height
//                     AS profile_photo_original_height,
//                 profile_photo.is_public
//                     AS profile_photo_is_public,

//                 profile_photo_variant.id
//                     AS profile_photo_variant_id,
//                 profile_photo_variant.variant_name
//                     AS profile_photo_variant_name,
//                 profile_photo_variant.format
//                     AS profile_photo_variant_format,
//                 profile_photo_variant.quality
//                     AS profile_photo_variant_quality,
//                 profile_photo_variant.width
//                     AS profile_photo_variant_width,
//                 profile_photo_variant.height
//                     AS profile_photo_variant_height,
//                 profile_photo_variant.storage_key
//                     AS profile_photo_variant_storage_key,

//                 cover_photo.id AS cover_photo_asset_id,
//                 cover_photo.storage_provider
//                     AS cover_photo_storage_provider,
//                 cover_photo.bucket
//                     AS cover_photo_bucket,
//                 cover_photo.storage_key
//                     AS cover_photo_original_storage_key,
//                 cover_photo.mime_type
//                     AS cover_photo_mime_type,
//                 cover_photo.original_width
//                     AS cover_photo_original_width,
//                 cover_photo.original_height
//                     AS cover_photo_original_height,
//                 cover_photo.is_public
//                     AS cover_photo_is_public,

//                 cover_photo_variant.id
//                     AS cover_photo_variant_id,
//                 cover_photo_variant.variant_name
//                     AS cover_photo_variant_name,
//                 cover_photo_variant.format
//                     AS cover_photo_variant_format,
//                 cover_photo_variant.quality
//                     AS cover_photo_variant_quality,
//                 cover_photo_variant.width
//                     AS cover_photo_variant_width,
//                 cover_photo_variant.height
//                     AS cover_photo_variant_height,
//                 cover_photo_variant.storage_key
//                     AS cover_photo_variant_storage_key,

//                 COALESCE(post_stats.total, 0)::integer
//                     AS posts_count,

//                 COALESCE(group_stats.total, 0)::integer
//                     AS groups_count,

//                 COALESCE(saved_item_stats.total, 0)::integer
//                     AS saved_items_count,

//                 COALESCE(visited_place_stats.total, 0)::integer
//                     AS visited_places_count

//             FROM users.profiles AS profile

//             LEFT JOIN poi.countries AS country
//                 ON country.id = profile.country_id

//             LEFT JOIN poi.cities AS city
//                 ON city.id = profile.city_id

//             LEFT JOIN media.assets AS profile_photo
//                 ON profile_photo.id = profile.profile_photo_asset_id
//                AND profile_photo.deleted_at IS NULL

//             LEFT JOIN LATERAL
//             (
//                 SELECT
//                     variant.id,
//                     variant.variant_name,
//                     variant.format,
//                     variant.quality,
//                     variant.width,
//                     variant.height,
//                     variant.storage_key
//                 FROM media.asset_variants AS variant
//                 WHERE variant.asset_id = profile_photo.id
//                 ORDER BY
//                     CASE UPPER(variant.variant_name)
//                         WHEN 'THUMBNAIL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.THUMBNAIL}
//                         WHEN 'SMALL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.SMALL}
//                         WHEN 'MEDIUM' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.MEDIUM}
//                         WHEN 'LARGE' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.LARGE}
//                         WHEN 'ORIGINAL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.ORIGINAL}
//                         ELSE
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.CUSTOM}
//                     END,
//                     CASE UPPER(variant.format)
//                         WHEN 'AVIF' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.AVIF}
//                         WHEN 'WEBP' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.WEBP}
//                         WHEN 'JPG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.JPG}
//                         WHEN 'JPEG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.JPEG}
//                         WHEN 'PNG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.PNG}
//                         ELSE 6
//                     END,
//                     variant.quality DESC NULLS LAST,
//                     variant.created_at DESC,
//                     variant.id
//                 LIMIT 1
//             ) AS profile_photo_variant
//                 ON TRUE

//             LEFT JOIN media.assets AS cover_photo
//                 ON cover_photo.id = profile.cover_photo_asset_id
//                AND cover_photo.deleted_at IS NULL

//             LEFT JOIN LATERAL
//             (
//                 SELECT
//                     variant.id,
//                     variant.variant_name,
//                     variant.format,
//                     variant.quality,
//                     variant.width,
//                     variant.height,
//                     variant.storage_key
//                 FROM media.asset_variants AS variant
//                 WHERE variant.asset_id = cover_photo.id
//                 ORDER BY
//                     CASE UPPER(variant.variant_name)
//                         WHEN 'THUMBNAIL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.THUMBNAIL}
//                         WHEN 'SMALL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.SMALL}
//                         WHEN 'MEDIUM' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.MEDIUM}
//                         WHEN 'LARGE' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.LARGE}
//                         WHEN 'ORIGINAL' THEN
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.ORIGINAL}
//                         ELSE
//                             ${PROFILE_IMAGE_VARIANT_PRIORITY.CUSTOM}
//                     END,
//                     CASE UPPER(variant.format)
//                         WHEN 'AVIF' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.AVIF}
//                         WHEN 'WEBP' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.WEBP}
//                         WHEN 'JPG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.JPG}
//                         WHEN 'JPEG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.JPEG}
//                         WHEN 'PNG' THEN
//                             ${PROFILE_IMAGE_FORMAT_PRIORITY.PNG}
//                         ELSE 6
//                     END,
//                     variant.quality DESC NULLS LAST,
//                     variant.created_at DESC,
//                     variant.id
//                 LIMIT 1
//             ) AS cover_photo_variant
//                 ON TRUE

//             LEFT JOIN LATERAL
//             (
//                 SELECT COUNT(*) AS total
//                 FROM explore.posts AS post
//                 WHERE post.user_id = profile.user_id
//             ) AS post_stats
//                 ON TRUE

//             LEFT JOIN LATERAL
//             (
//                 SELECT COUNT(*) AS total
//                 FROM groups.group_members AS member
//                 INNER JOIN groups.groups AS user_group
//                     ON user_group.id = member.group_id
//                    AND user_group.status = 'ACTIVE'
//                    AND user_group.deleted_at IS NULL
//                 WHERE member.user_id = profile.user_id
//             ) AS group_stats
//                 ON TRUE

//             LEFT JOIN LATERAL
//             (
//                 SELECT COUNT(*) AS total
//                 FROM users.saved_items AS saved_item
//                 WHERE saved_item.user_id = profile.user_id
//             ) AS saved_item_stats
//                 ON TRUE

//             LEFT JOIN LATERAL
//             (
//                 SELECT COUNT(*) AS total
//                 FROM users.visited_places AS visited_place
//                 WHERE visited_place.user_id = profile.user_id
//             ) AS visited_place_stats
//                 ON TRUE

//             WHERE profile.user_id = $1
//               AND profile.deleted_at IS NULL

//             LIMIT 1
//         `;

//     const { rows } = await this.query(query, [userId]);

//     return rows[0] ?? null;
//   }
// }

// export default new ProfilesRepository();
// cat > src/modules/users/repositories/profiles.repository.js <<'EOF'
import BaseRepository from "../../../database/repositories/base.repository.js";

const PROFILE_IMAGE_VARIANT_PRIORITY = Object.freeze({
  THUMBNAIL: 1,
  SMALL: 2,
  MEDIUM: 3,
  LARGE: 4,
  ORIGINAL: 5,
  CUSTOM: 6,
});

const PROFILE_IMAGE_FORMAT_PRIORITY = Object.freeze({
  AVIF: 1,
  WEBP: 2,
  JPG: 3,
  JPEG: 4,
  PNG: 5,
});

class ProfilesRepository extends BaseRepository {
  constructor() {
    super("users", "profiles");
  }

  async create({
    userId,
    username,
    displayName = null,
    bio = null,
    profilePhotoAssetId = null,
    coverPhotoAssetId = null,
    countryId = null,
    cityId = null,
    socialLinks = {},
  }) {
    const query = `
            INSERT INTO ${this.fullTableName}
            (
                user_id,
                username,
                display_name,
                bio,
                profile_photo_asset_id,
                cover_photo_asset_id,
                country_id,
                city_id,
                social_links
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::jsonb
            )
            RETURNING
                user_id,
                username,
                display_name,
                bio,
                profile_photo_asset_id,
                cover_photo_asset_id,
                country_id,
                city_id,
                social_links,
                is_verified,
                profile_completed_at,
                created_at,
                updated_at
        `;

    const params = [
      userId,
      username,
      displayName,
      bio,
      profilePhotoAssetId,
      coverPhotoAssetId,
      countryId,
      cityId,
      JSON.stringify(socialLinks),
    ];

    const { rows } = await this.query(query, params);

    return rows[0] ?? null;
  }

  /**
   * Fetches the authenticated user's complete profile in one database
   * round trip.
   *
   * Includes:
   * - Profile information
   * - Country and city
   * - Original asset metadata
   * - Preferred image variant
   * - User-specific counters
   *
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async findByUserId(userId) {
    const query = `
            SELECT
                profile.user_id,
                profile.username,
                profile.display_name,
                profile.bio,
                profile.social_links,
                profile.is_verified,
                profile.profile_completed_at,
                profile.created_at,
                profile.updated_at,

                country.id AS country_id,
                country.name AS country_name,
                country.code AS country_code,
                country.is_active AS country_is_active,

                city.id AS city_id,
                city.name AS city_name,
                city.official_name AS city_official_name,
                city.country_id AS city_country_id,
                city.is_active AS city_is_active,

                profile_photo.id AS profile_photo_asset_id,
                profile_photo.storage_provider
                    AS profile_photo_storage_provider,
                profile_photo.bucket
                    AS profile_photo_bucket,
                profile_photo.storage_key
                    AS profile_photo_original_storage_key,
                profile_photo.mime_type
                    AS profile_photo_mime_type,
                profile_photo.original_width
                    AS profile_photo_original_width,
                profile_photo.original_height
                    AS profile_photo_original_height,
                profile_photo.is_public
                    AS profile_photo_is_public,

                profile_photo_variant.id
                    AS profile_photo_variant_id,
                profile_photo_variant.variant_name
                    AS profile_photo_variant_name,
                profile_photo_variant.format
                    AS profile_photo_variant_format,
                profile_photo_variant.quality
                    AS profile_photo_variant_quality,
                profile_photo_variant.width
                    AS profile_photo_variant_width,
                profile_photo_variant.height
                    AS profile_photo_variant_height,
                profile_photo_variant.storage_key
                    AS profile_photo_variant_storage_key,

                cover_photo.id AS cover_photo_asset_id,
                cover_photo.storage_provider
                    AS cover_photo_storage_provider,
                cover_photo.bucket
                    AS cover_photo_bucket,
                cover_photo.storage_key
                    AS cover_photo_original_storage_key,
                cover_photo.mime_type
                    AS cover_photo_mime_type,
                cover_photo.original_width
                    AS cover_photo_original_width,
                cover_photo.original_height
                    AS cover_photo_original_height,
                cover_photo.is_public
                    AS cover_photo_is_public,

                cover_photo_variant.id
                    AS cover_photo_variant_id,
                cover_photo_variant.variant_name
                    AS cover_photo_variant_name,
                cover_photo_variant.format
                    AS cover_photo_variant_format,
                cover_photo_variant.quality
                    AS cover_photo_variant_quality,
                cover_photo_variant.width
                    AS cover_photo_variant_width,
                cover_photo_variant.height
                    AS cover_photo_variant_height,
                cover_photo_variant.storage_key
                    AS cover_photo_variant_storage_key,

                COALESCE(post_stats.total, 0)::integer
                    AS posts_count,

                COALESCE(group_stats.total, 0)::integer
                    AS groups_count,

                COALESCE(saved_item_stats.total, 0)::integer
                    AS saved_items_count,

                COALESCE(visited_place_stats.total, 0)::integer
                    AS visited_places_count

            FROM users.profiles AS profile

            LEFT JOIN poi.countries AS country
                ON country.id = profile.country_id

            LEFT JOIN poi.cities AS city
                ON city.id = profile.city_id

            LEFT JOIN media.assets AS profile_photo
                ON profile_photo.id = profile.profile_photo_asset_id
               AND profile_photo.deleted_at IS NULL

            LEFT JOIN LATERAL
            (
                SELECT
                    variant.id,
                    variant.variant_name,
                    variant.format,
                    variant.quality,
                    variant.width,
                    variant.height,
                    variant.storage_key
                FROM media.asset_variants AS variant
                WHERE variant.asset_id = profile_photo.id
                ORDER BY
                    CASE UPPER(variant.variant_name)
                        WHEN 'THUMBNAIL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.THUMBNAIL}
                        WHEN 'SMALL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.SMALL}
                        WHEN 'MEDIUM' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.MEDIUM}
                        WHEN 'LARGE' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.LARGE}
                        WHEN 'ORIGINAL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.ORIGINAL}
                        ELSE
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.CUSTOM}
                    END,
                    CASE UPPER(variant.format)
                        WHEN 'AVIF' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.AVIF}
                        WHEN 'WEBP' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.WEBP}
                        WHEN 'JPG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.JPG}
                        WHEN 'JPEG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.JPEG}
                        WHEN 'PNG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.PNG}
                        ELSE 6
                    END,
                    variant.quality DESC NULLS LAST,
                    variant.created_at DESC,
                    variant.id
                LIMIT 1
            ) AS profile_photo_variant
                ON TRUE

            LEFT JOIN media.assets AS cover_photo
                ON cover_photo.id = profile.cover_photo_asset_id
               AND cover_photo.deleted_at IS NULL

            LEFT JOIN LATERAL
            (
                SELECT
                    variant.id,
                    variant.variant_name,
                    variant.format,
                    variant.quality,
                    variant.width,
                    variant.height,
                    variant.storage_key
                FROM media.asset_variants AS variant
                WHERE variant.asset_id = cover_photo.id
                ORDER BY
                    CASE UPPER(variant.variant_name)
                        WHEN 'THUMBNAIL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.THUMBNAIL}
                        WHEN 'SMALL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.SMALL}
                        WHEN 'MEDIUM' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.MEDIUM}
                        WHEN 'LARGE' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.LARGE}
                        WHEN 'ORIGINAL' THEN
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.ORIGINAL}
                        ELSE
                            ${PROFILE_IMAGE_VARIANT_PRIORITY.CUSTOM}
                    END,
                    CASE UPPER(variant.format)
                        WHEN 'AVIF' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.AVIF}
                        WHEN 'WEBP' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.WEBP}
                        WHEN 'JPG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.JPG}
                        WHEN 'JPEG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.JPEG}
                        WHEN 'PNG' THEN
                            ${PROFILE_IMAGE_FORMAT_PRIORITY.PNG}
                        ELSE 6
                    END,
                    variant.quality DESC NULLS LAST,
                    variant.created_at DESC,
                    variant.id
                LIMIT 1
            ) AS cover_photo_variant
                ON TRUE

            LEFT JOIN LATERAL
            (
                SELECT COUNT(*) AS total
                FROM explore.posts AS post
                WHERE post.user_id = profile.user_id
            ) AS post_stats
                ON TRUE

            LEFT JOIN LATERAL
            (
                SELECT COUNT(*) AS total
                FROM groups.group_members AS member
                INNER JOIN groups.groups AS user_group
                    ON user_group.id = member.group_id
                   AND user_group.status = 'ACTIVE'
                   AND user_group.deleted_at IS NULL
                WHERE member.user_id = profile.user_id
            ) AS group_stats
                ON TRUE

            LEFT JOIN LATERAL
            (
                SELECT COUNT(*) AS total
                FROM users.saved_items AS saved_item
                WHERE saved_item.user_id = profile.user_id
            ) AS saved_item_stats
                ON TRUE

            LEFT JOIN LATERAL
            (
                SELECT COUNT(*) AS total
                FROM users.visited_places AS visited_place
                WHERE visited_place.user_id = profile.user_id
            ) AS visited_place_stats
                ON TRUE

            WHERE profile.user_id = $1
              AND profile.deleted_at IS NULL

            LIMIT 1
        `;

    const { rows } = await this.query(query, [userId]);

    return rows[0] ?? null;
  }
}

export default new ProfilesRepository();
