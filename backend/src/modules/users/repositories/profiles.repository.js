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
 * Returns only the current fields required to
 * validate a partial profile update.
 */
async findUpdateContext(userId) {
  const query = `
    SELECT
      profile.user_id,
      profile.username,
      profile.display_name,
      profile.bio,
      profile.profile_photo_asset_id,
      profile.country_id,
      profile.city_id,
      profile.is_private

    FROM users.profiles AS profile

    WHERE profile.user_id = $1::uuid
      AND profile.deleted_at IS NULL

    LIMIT 1
  `;

  const { rows } = await this.query(
    query,
    [userId],
  );

  return rows[0] ?? null;
}

/**
 * Checks whether another profile already uses
 * the requested username.
 *
 * Deleted profiles are included because the live
 * database also has a global unique username index.
 */
async findUsernameConflict({
  username,
  userId,
}) {
  const query = `
    SELECT
      profile.user_id,
      profile.username

    FROM users.profiles AS profile

    WHERE LOWER(profile.username) =
        LOWER($1)

      AND profile.user_id <>
        $2::uuid

    LIMIT 1
  `;

  const { rows } = await this.query(
    query,
    [
      username,
      userId,
    ],
  );

  return rows[0] ?? null;
}

/**
 * Returns a profile-photo asset only when it is
 * active, image-based, and owned by the viewer.
 */
async findOwnedProfilePhoto({
  assetId,
  userId,
}) {
  const query = `
    SELECT
      asset.id,
      asset.uploaded_by,
      asset.mime_type,
      asset.is_public,
      asset.deleted_at

    FROM media.assets AS asset

    WHERE asset.id = $1::uuid

      AND asset.uploaded_by =
        $2::uuid

      AND asset.deleted_at IS NULL

      AND LOWER(asset.mime_type)
        LIKE 'image/%'

    LIMIT 1
  `;

  const { rows } = await this.query(
    query,
    [
      assetId,
      userId,
    ],
  );

  return rows[0] ?? null;
}

/**
 * Returns an active country.
 */
async findActiveCountry(countryId) {
  const query = `
    SELECT
      country.id,
      country.name,
      country.code

    FROM poi.countries AS country

    WHERE country.id = $1::uuid
      AND country.is_active IS TRUE

    LIMIT 1
  `;

  const { rows } = await this.query(
    query,
    [countryId],
  );

  return rows[0] ?? null;
}

/**
 * Returns an active city and the country to which
 * it belongs.
 */
async findActiveCity(cityId) {
  const query = `
    SELECT
      city.id,
      city.name,
      city.country_id

    FROM poi.cities AS city

    WHERE city.id = $1::uuid
      AND city.is_active IS TRUE

    LIMIT 1
  `;

  const { rows } = await this.query(
    query,
    [cityId],
  );

  return rows[0] ?? null;
}

/**
 * Applies only explicitly supplied fields.
 * Omitted fields are never included in the SET list.
 */
async updatePartial({
  userId,
  changes,
  client = null,
}) {
  const columnByField =
    Object.freeze({
      username:
        "username",

      displayName:
        "display_name",

      bio:
        "bio",

      profilePhotoAssetId:
        "profile_photo_asset_id",

      countryId:
        "country_id",

      cityId:
        "city_id",

      isPrivate:
        "is_private",
    });

  const entries =
    Object.entries(changes)
      .filter(
        ([field]) =>
          Object.hasOwn(
            columnByField,
            field,
          ),
      );

  if (entries.length === 0) {
    return null;
  }

  const values = [userId];

  const setClauses =
    entries.map(
      ([field, value]) => {
        values.push(value);

        return `${
          columnByField[field]
        } = $${values.length}`;
      },
    );

  const query = `
    UPDATE users.profiles

    SET
      ${setClauses.join(",\n      ")}

    WHERE user_id = $1::uuid
      AND deleted_at IS NULL

    RETURNING
      user_id,
      username,
      display_name,
      bio,
      profile_photo_asset_id,
      country_id,
      city_id,
      is_private,
      updated_at
  `;

 const executeQuery =
    client
      ? client.query.bind(
        client,
      )
      : this.query.bind(
        this,
      );

  const {
    rows,
  } = await executeQuery(
    query,
    values,
  );

  return rows[0] ?? null;
}


  /**
   * Fetch the authenticated user's complete profile.
   *
   * Includes:
   * - Profile information
   * - Country and city
   * - Profile and cover photo metadata
   * - Preferred asset variants
   * - Connection, post, group and saved-item counts
   * - Preferred visited collections
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
        profile.is_private,
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
profile_photo.original_filename
  AS profile_photo_original_file_name,
profile_photo.extension
  AS profile_photo_extension,
profile_photo.file_size
  AS profile_photo_file_size,
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
cover_photo.original_filename
  AS cover_photo_original_file_name,
cover_photo.extension
  AS cover_photo_extension,
cover_photo.file_size
  AS cover_photo_file_size,
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

        0::integer AS connections_count,

        COALESCE(
          preferred_collection_stats.total_places,
          0
        )::integer AS visited_places_count,

        COALESCE(
          preferred_collection_stats.collections,
          '[]'::jsonb
        ) AS preferred_visited_collections

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
  SELECT
    COALESCE(
      SUM(collection_data.place_count),
      0
    )::integer AS total_places,

    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id',
            collection_data.id,

          'name',
            collection_data.name,

          'visitedAt',
            collection_data.visited_at,

          'verificationStatus',
            collection_data.verification_status,

          'iconAssetId',
            collection_data.icon_asset_id,

          'verificationAssetId',
            collection_data.verification_asset_id,

          'places',
            collection_data.places
        )
        ORDER BY
          collection_data.visited_at DESC NULLS LAST,
          collection_data.id
      ),
      '[]'::jsonb
    ) AS collections

  FROM
  (
    SELECT
      user_collection.id,
      user_collection.collections_name AS name,
      user_collection.visited_at,
      user_collection.verification_status,
      user_collection.icon_asset_id,
      user_collection.verification_asset_id,

      COUNT(
        DISTINCT visited_place.place_id
      )::integer AS place_count,

      COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id',
              place.id,

            'name',
              place.name,

            'latitude',
              place.latitude,

            'longitude',
              place.longitude,

            'mediaAssetId',
              place.media_id
          )
          ORDER BY
            place.name,
            place.id
        ) FILTER (
          WHERE place.id IS NOT NULL
        ),
        '[]'::jsonb
      ) AS places

    FROM users.collection AS user_collection

    LEFT JOIN users.visited_places AS visited_place
      ON visited_place.collections_id = user_collection.id
     AND visited_place.user_id = profile.user_id

    LEFT JOIN poi.places AS place
      ON place.id = visited_place.place_id

    WHERE user_collection.user_id = profile.user_id
      AND user_collection.is_preference IS TRUE

    GROUP BY
      user_collection.id,
      user_collection.collections_name,
      user_collection.visited_at,
      user_collection.verification_status,
      user_collection.icon_asset_id,
      user_collection.verification_asset_id
  ) AS collection_data
) AS preferred_collection_stats
  ON TRUE

      WHERE profile.user_id = $1
        AND profile.deleted_at IS NULL

      LIMIT 1
    `;

    const { rows } = await this.query(query, [userId]);

    return rows[0] ?? null;
  }

  /**
 * Finds an active user profile by username.
 *
 * Used when another person visits a user's public profile.
 *
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async findByUsername(username) {
    const normalizedUsername =
      typeof username === "string"
        ? username.trim()
        : "";
  
    if (!normalizedUsername) {
      return null;
    }
  
    const query = `
      SELECT
        profile.user_id,
        profile.username,
        profile.display_name,
        profile.bio,
        profile.profile_photo_asset_id,
        profile.is_private,
        profile.is_verified,
        profile.created_at,
        profile.updated_at
      FROM users.profiles AS profile
      WHERE LOWER(profile.username) = LOWER($1)
        AND profile.deleted_at IS NULL
      LIMIT 1
    `;
  
    const { rows } = await this.query(query, [
      normalizedUsername,
    ]);
  
    return rows[0] ?? null;
  }
}

export default new ProfilesRepository();


