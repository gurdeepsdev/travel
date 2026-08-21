import Database
  from "../../../database/database-manager.js";

const CITY_CATEGORY_PATTERNS = {
  PEACEFUL: [
    "%nature%",
    "%park%",
    "%garden%",
    "%religious%",
    "%wellness%",
    "%spa%",
  ],
  FUN: [
    "%entertainment%",
    "%activit%",
    "%amusement%",
    "%nightlife%",
    "%dining%",
    "%drink%",
    "%shopping%",
    "%market%",
    "%mall%",
  ],
  HISTORY_AND_CULTURE: [
    "%culture%",
    "%heritage%",
    "%historic%",
    "%museum%",
    "%monument%",
    "%religious%",
    "%tourist attraction%",
  ],
  ADVENTURE: [
    "%adventure%",
    "%outdoor%",
    "%nature%",
    "%hiking%",
    "%trek%",
    "%water sport%",
  ],
};

class ExploreRepository {




  async listPopularCities({
    category = "FOR_YOU",
    limit = 10,
  } = {}) {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          Number(limit) || 10,
          20,
        ),
      );

    const categoryPatterns =
      CITY_CATEGORY_PATTERNS[
        category
      ] ?? null;

    const sql = `
      SELECT
        city.id,
        city.name,
        city.official_name,
        city.latitude,
        city.longitude,

        country.id
          AS country_id,

        country.name
          AS country_name,

        country.code
          AS country_code,

        place_stats.place_count,
        place_stats.places_with_media,

        COALESCE(
          city_icon.id,
          cover_asset.id
        ) AS image_asset_id,

        COALESCE(
          city_icon.storage_provider,
          cover_asset.storage_provider
        ) AS image_storage_provider,

        COALESCE(
          city_icon.storage_key,
          cover_asset.storage_key
        ) AS image_storage_key,

        COALESCE(
          city_icon.mime_type,
          cover_asset.mime_type
        ) AS image_mime_type,

        COALESCE(
          city_icon.is_public,
          cover_asset.is_public,
          FALSE
        ) AS image_is_public

      FROM poi.cities
        AS city

      INNER JOIN poi.countries
        AS country
        ON country.id =
          city.country_id

      INNER JOIN LATERAL (
        SELECT
          COUNT(*)::integer
            AS place_count,

          COUNT(
            place.media_id
          )::integer
            AS places_with_media

        FROM poi.places
          AS place

        WHERE place.city_id =
            city.id

          AND COALESCE(
            place.is_closed,
            FALSE
          ) IS FALSE
      ) AS place_stats
        ON place_stats.place_count >
          0

      LEFT JOIN media.assets
        AS city_icon
        ON city_icon.id =
          city.icon_asset_id

       AND city_icon.deleted_at
          IS NULL

       AND city_icon.is_public
          IS TRUE

      LEFT JOIN LATERAL (
        SELECT
          asset.id,
          asset.storage_provider,
          asset.storage_key,
          asset.mime_type,
          asset.is_public

        FROM poi.places
          AS place

        INNER JOIN media.assets
          AS asset
          ON asset.id =
            place.media_id

         AND asset.deleted_at
            IS NULL

         AND asset.is_public
            IS TRUE

         AND asset.mime_type
            LIKE 'image/%'

        WHERE place.city_id =
            city.id

          AND COALESCE(
            place.is_closed,
            FALSE
          ) IS FALSE

        ORDER BY
          place.rating DESC
            NULLS LAST,

          place.review_count DESC,

          place.id ASC

        LIMIT 1
      ) AS cover_asset
        ON TRUE

      WHERE city.is_active
        IS TRUE

        AND (
          $2::varchar[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM poi.places
              AS category_place
            INNER JOIN poi.categories
              AS category
              ON category.id =
                category_place.category_id
            WHERE category_place.city_id =
                city.id
              AND COALESCE(
                category_place.is_closed,
                FALSE
              ) IS FALSE
              AND category.name ILIKE ANY(
                $2::varchar[]
              )
          )
        )

      ORDER BY
        place_stats
          .places_with_media DESC,

        place_stats
          .place_count DESC,

        city.name ASC,

        city.id ASC

      LIMIT $1
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          safeLimit,
          categoryPatterns,
        ],
      );

    return rows;
  }



    async listPlaces({
    cityId = null,
    latitude = null,
    longitude = null,
    radiusKm = 50,
    limit = 10,
  } = {}) {
    const hasLocation =
      latitude !== null &&
      longitude !== null;

    const safeLimit =
      Math.max(
        1,
        Math.min(
          Number(limit) || 10,
          cityId
            ? 50
            : 20,
        ),
      );

    const safeRadiusKm =
      Math.max(
        1,
        Math.min(
          Number(radiusKm) || 50,
          500,
        ),
      );

    const sql = `
      SELECT
        place.id,
        place.name,
        place.description,
        place.address,
        place.postal_code,
        place.latitude,
        place.longitude,
        place.rating,
        place.review_count,
        place.recommended_duration,
        place.booking_type,
        place.require_ticket,
        place.itinerary_worthiness,

        city.id
          AS city_id,

        city.name
          AS city_name,

        city.official_name
          AS city_official_name,

        country.id
          AS country_id,

        country.name
          AS country_name,

        country.code
          AS country_code,

        category.id
          AS category_id,

        category.name
          AS category_name,

        asset.id
          AS image_asset_id,

        asset.storage_provider
          AS image_storage_provider,

        asset.storage_key
          AS image_storage_key,

        asset.mime_type
          AS image_mime_type,

        asset.is_public
          AS image_is_public,

        distance.distance_km

      FROM poi.places
        AS place

      INNER JOIN poi.cities
        AS city
        ON city.id =
          place.city_id

       AND city.is_active
          IS TRUE

      INNER JOIN poi.countries
        AS country
        ON country.id =
          place.country_id

      LEFT JOIN poi.categories
        AS category
        ON category.id =
          place.category_id

      LEFT JOIN media.assets
        AS asset
        ON asset.id =
          place.media_id

       AND asset.deleted_at
          IS NULL

       AND asset.is_public
          IS TRUE

       AND asset.mime_type
          LIKE 'image/%'

      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN $1::double precision
              IS NULL
            THEN NULL

            ELSE (
              6371 * 2 * ASIN(
                SQRT(
                  POWER(
                    SIN(
                      RADIANS(
                        place.latitude -
                        $1::double precision
                      ) / 2
                    ),
                    2
                  )
                  +
                  COS(
                    RADIANS(
                      $1::double precision
                    )
                  )
                  *
                  COS(
                    RADIANS(
                      place.latitude
                    )
                  )
                  *
                  POWER(
                    SIN(
                      RADIANS(
                        place.longitude -
                        $2::double precision
                      ) / 2
                    ),
                    2
                  )
                )
              )
            )
          END AS distance_km
      ) AS distance

      WHERE COALESCE(
        place.is_closed,
        FALSE
      ) IS FALSE

        AND (
          $1::double precision
            IS NULL

          OR distance.distance_km <=
            $3::double precision
        )

        AND (
          $4::uuid
            IS NULL

          OR place.city_id =
            $4::uuid
        )

      ORDER BY
        CASE
          WHEN $1::double precision
            IS NOT NULL
          THEN distance.distance_km
        END ASC
          NULLS LAST,

        place.rating DESC
          NULLS LAST,

        place.review_count DESC,

        place.name ASC,

        place.id ASC

      LIMIT $5
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          hasLocation
            ? Number(latitude)
            : null,

          hasLocation
            ? Number(longitude)
            : null,

          safeRadiusKm,

          cityId,

          safeLimit,
        ],
      );

    return rows;
  }

    async listFeedPostIds({
    viewerUserId = null,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          Number(limit) || 20,
          50,
        ),
      );

    const params = [
      viewerUserId,
    ];

    let cursorCondition =
      "";

    if (
      cursor?.createdAt &&
      cursor?.id
    ) {
      params.push(
        cursor.createdAt,
        cursor.id,
      );

      cursorCondition = `
        AND (
          post.created_at,
          post.id
        ) < (
          $2::timestamp,
          $3::uuid
        )
      `;
    }

    params.push(
      safeLimit + 1,
    );

    const limitParameterIndex =
      params.length;

    const sql = `
      SELECT
        post.id,
        post.created_at,

        post.created_at::text
          AS cursor_created_at

      FROM explore.posts
        AS post

      INNER JOIN auth.users
        AS author_user
        ON author_user.id =
          post.user_id

       AND author_user.status =
          'ACTIVE'

      INNER JOIN users.profiles
        AS author_profile
        ON author_profile.user_id =
          author_user.id

       AND author_profile.deleted_at
          IS NULL

      WHERE UPPER(
        post.visibility
      ) = 'PUBLIC'

        AND post.deleted_at
          IS NULL

        AND COALESCE(
          author_profile.is_private,
          FALSE
        ) IS FALSE

        AND (
          $1::uuid
            IS NULL

          OR NOT EXISTS (
            SELECT 1

            FROM users.blocked_users
              AS blocked

            WHERE (
              blocked.user_id =
                $1::uuid

              AND blocked.blocked_user_id =
                post.user_id
            )
            OR (
              blocked.user_id =
                post.user_id

              AND blocked.blocked_user_id =
                $1::uuid
            )
          )
        )

      ${cursorCondition}

      ORDER BY
        post.created_at DESC,
        post.id DESC

      LIMIT $${limitParameterIndex}
    `;

    const { rows } =
      await Database.query(
        sql,
        params,
      );

    const hasMore =
      rows.length >
        safeLimit;

    const paginatedRows =
      hasMore
        ? rows.slice(
            0,
            safeLimit,
          )
        : rows;

    return {
      rows:
        paginatedRows,

      hasMore,

      lastRow:
        paginatedRows.at(-1) ??
        null,
    };
  }
}

export default new ExploreRepository();
