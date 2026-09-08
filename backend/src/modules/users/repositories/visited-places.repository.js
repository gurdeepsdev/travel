import Database
  from "../../../database/database-manager.js";

class VisitedPlacesRepository {
  async listVerifications({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit = Math.min(
      Math.max(Number(limit) || 20, 1),
      50,
    );
    const params = [userId];
    let cursorWhere = "";

    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      cursorWhere = `
        WHERE (
          verification.created_at,
          verification.verification_id
        ) < (
          $2::timestamptz,
          $3::uuid
        )
      `;
    }

    params.push(safeLimit + 1);
    const limitParameterIndex = params.length;
    const sql = `
      SELECT *
      FROM (
        SELECT
          'PLACE'::varchar AS target_type,
          visited_place.id AS verification_id,
          visited_place.verification_status,
          visited_place.verification_details,
          visited_place.created_at,
          visited_place.updated_at,
          place.id AS location_id,
          place.name AS location_name,
          city.id AS city_id,
          city.name AS city_name,
          country.id AS country_id,
          country.name AS country_name,
          asset.id AS asset_id,
          asset.storage_provider,
          asset.storage_key,
          asset.is_public,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size
        FROM users.visited_places visited_place
        INNER JOIN poi.places place
          ON place.id = visited_place.place_id
        INNER JOIN poi.cities city
          ON city.id = place.city_id
        INNER JOIN poi.countries country
          ON country.id = place.country_id
        LEFT JOIN media.assets asset
          ON asset.id = visited_place.verification_asset_id
          AND asset.deleted_at IS NULL
        WHERE visited_place.user_id = $1::uuid
          AND visited_place.verification_status IN (
            'PENDING',
            'VERIFIED'
          )

        UNION ALL

        SELECT
          'CITY'::varchar AS target_type,
          user_collection.id AS verification_id,
          CASE
            WHEN user_collection.verification_status IS TRUE
              THEN 'VERIFIED'
            ELSE 'PENDING'
          END::varchar AS verification_status,
          '{}'::jsonb AS verification_details,
          user_collection.created_at,
          user_collection.updated_at,
          city.id AS location_id,
          city.name AS location_name,
          city.id AS city_id,
          city.name AS city_name,
          country.id AS country_id,
          country.name AS country_name,
          asset.id AS asset_id,
          asset.storage_provider,
          asset.storage_key,
          asset.is_public,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size
        FROM users.collection user_collection
        INNER JOIN poi.cities city
          ON city.id = user_collection.city_id
        INNER JOIN poi.countries country
          ON country.id = city.country_id
        LEFT JOIN media.assets asset
          ON asset.id = user_collection.verification_asset_id
          AND asset.deleted_at IS NULL
        WHERE user_collection.user_id = $1::uuid
      ) AS verification
      ${cursorWhere}
      ORDER BY
        verification.created_at DESC,
        verification.verification_id DESC
      LIMIT $${limitParameterIndex}
    `;

    const { rows } = await Database.query(
      sql,
      params,
    );
    const hasMore = rows.length > safeLimit;
    const paginatedRows = hasMore
      ? rows.slice(0, safeLimit)
      : rows;

    return {
      rows: paginatedRows,
      hasMore,
      lastRow:
        paginatedRows[
          paginatedRows.length - 1
        ] ?? null,
    };
  }

  async findVerificationById({
    userId,
    verificationId,
  }) {
    const sql = `
      SELECT
        'PLACE'::varchar AS target_type,
        visited_place.id AS verification_id,
        visited_place.verification_status,
        visited_place.verification_details,
        visited_place.created_at,
        visited_place.updated_at,
        place.id AS location_id,
        place.name AS location_name,
        city.id AS city_id,
        city.name AS city_name,
        country.id AS country_id,
        country.name AS country_name,
        asset.id AS asset_id,
        asset.storage_provider,
        asset.storage_key,
        asset.is_public,
        asset.original_filename,
        asset.mime_type,
        asset.extension,
        asset.file_size
      FROM users.visited_places visited_place
      INNER JOIN poi.places place
        ON place.id = visited_place.place_id
      INNER JOIN poi.cities city
        ON city.id = place.city_id
      INNER JOIN poi.countries country
        ON country.id = place.country_id
      LEFT JOIN media.assets asset
        ON asset.id = visited_place.verification_asset_id
        AND asset.deleted_at IS NULL
      WHERE visited_place.id = $2::uuid
        AND visited_place.user_id = $1::uuid

      UNION ALL

      SELECT
        'CITY'::varchar AS target_type,
        user_collection.id AS verification_id,
        CASE
          WHEN user_collection.verification_status IS TRUE
            THEN 'VERIFIED'
          ELSE 'PENDING'
        END::varchar AS verification_status,
        '{}'::jsonb AS verification_details,
        user_collection.created_at,
        user_collection.updated_at,
        city.id AS location_id,
        city.name AS location_name,
        city.id AS city_id,
        city.name AS city_name,
        country.id AS country_id,
        country.name AS country_name,
        asset.id AS asset_id,
        asset.storage_provider,
        asset.storage_key,
        asset.is_public,
        asset.original_filename,
        asset.mime_type,
        asset.extension,
        asset.file_size
      FROM users.collection user_collection
      INNER JOIN poi.cities city
        ON city.id = user_collection.city_id
      INNER JOIN poi.countries country
        ON country.id = city.country_id
      LEFT JOIN media.assets asset
        ON asset.id = user_collection.verification_asset_id
        AND asset.deleted_at IS NULL
      WHERE user_collection.id = $2::uuid
        AND user_collection.user_id = $1::uuid

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        userId,
        verificationId,
      ],
    );

    return rows[0] ?? null;
  }

  async resolveVerificationLocation({
    locationId,
  }) {
    const sql = `
      SELECT
        'PLACE'::varchar AS location_type,
        place.id AS location_id
      FROM poi.places place
      WHERE place.id::text = $1::varchar
        OR place.provider_id = $1::varchar

      UNION ALL

      SELECT
        'CITY'::varchar AS location_type,
        city.id AS location_id
      FROM poi.cities city
      WHERE city.id::text = $1::varchar
        OR city.provider_id = $1::varchar

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        locationId,
      ],
    );

    return rows[0] ?? null;
  }

  async savePendingVisit({
    client,
    userId,
    placeId,
    verificationAssetId,
    claimedVisitedAt = null,
    evidenceCapturedAt = null,
    evidenceLatitude = null,
    evidenceLongitude = null,
    evidenceSha256,
    evidencePerceptualHash = null,
    visitedAt = null,
    verificationDetails,
  }) {
    const sql = `
      WITH pending_collection AS (
        INSERT INTO users.collection AS user_collection (
          user_id, city_id, collections_name,
          icon_asset_id, verification_asset_id,
          verification_status, visited_at,
          is_preference
        )
        SELECT
          $1::uuid, city.id, city.name,
          city.icon_asset_id, $3::uuid,
          FALSE, COALESCE($9::timestamptz, CURRENT_TIMESTAMP),
          FALSE
        FROM poi.places place
        INNER JOIN poi.cities city
          ON city.id = place.city_id
        WHERE place.id = $2::uuid
        ON CONFLICT (user_id, city_id)
        DO UPDATE SET
          verification_asset_id = EXCLUDED.verification_asset_id,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_collection.verification_status IS FALSE
        RETURNING id, city_id
      ),
      inserted_visit AS (
        INSERT INTO users.visited_places (
          user_id, place_id, collections_id,
          verification_asset_id, verification_status,
          visit_source, visited_at, claimed_visited_at,
          evidence_captured_at, evidence_latitude,
          evidence_longitude, evidence_sha256,
          evidence_perceptual_hash, verification_details
        )
        SELECT
          $1::uuid, $2::uuid, pending_collection.id,
          $3::uuid, 'PENDING', 'PHOTO_VERIFICATION',
          COALESCE($9::timestamptz, CURRENT_TIMESTAMP),
          $4::timestamptz, $5::timestamptz,
          $6::double precision, $7::double precision,
          $8::varchar, $10::varchar, $11::jsonb
        FROM pending_collection
        RETURNING *, TRUE AS visit_created
      )
      SELECT
        inserted_visit.*,
        place.name AS place_name,
        city.id AS city_id,
        city.name AS city_name
      FROM inserted_visit
      INNER JOIN poi.places place
        ON place.id = inserted_visit.place_id
      INNER JOIN poi.cities city
        ON city.id = place.city_id
    `;

    const { rows } = await client.query(sql, [
      userId,
      placeId,
      verificationAssetId,
      claimedVisitedAt,
      evidenceCapturedAt,
      evidenceLatitude,
      evidenceLongitude,
      evidenceSha256,
      visitedAt,
      evidencePerceptualHash,
      JSON.stringify(verificationDetails ?? {}),
    ]);

    return rows[0] ?? null;
  }

  async savePendingCity({
    client,
    userId,
    cityId,
    verificationAssetId,
    visitedAt = null,
  }) {
    const sql = `
      INSERT INTO users.collection AS user_collection (
        user_id, city_id, collections_name,
        icon_asset_id, verification_asset_id,
        verification_status, visited_at,
        is_preference
      )
      SELECT
        $1::uuid, city.id, city.name,
        city.icon_asset_id, $3::uuid,
        FALSE, COALESCE($4::timestamptz, CURRENT_TIMESTAMP),
        FALSE
      FROM poi.cities city
      WHERE city.id = $2::uuid
        AND city.is_active IS TRUE
      ON CONFLICT (user_id, city_id)
      DO UPDATE SET
        verification_asset_id = EXCLUDED.verification_asset_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_collection.verification_status IS FALSE
      RETURNING *, collections_name AS city_name
    `;

    const { rows } = await client.query(sql, [
      userId,
      cityId,
      verificationAssetId,
      visitedAt,
    ]);

    return rows[0] ?? null;
  }

  async findCityVerificationContext({
    client = Database,
    userId,
    cityId = null,
    googleCityPlaceId = null,
    evidenceSha256,
  }) {
    const sql = `
      SELECT
        city.id AS city_id,
        city.name AS city_name,
        city.official_name
          AS city_official_name,
        city.latitude AS city_latitude,
        city.longitude AS city_longitude,
        city.icon_asset_id
          AS city_icon_asset_id,
        country.id AS country_id,
        country.name AS country_name,
        (
          city.id IS NOT NULL
          AND city.is_active IS TRUE
          AND city.latitude IS NOT NULL
          AND city.longitude IS NOT NULL
        ) AS city_available,
        user_collection.id
          AS existing_collection_id,
        user_collection.verification_status
          AS existing_collection_verified,
        duplicate_evidence.id
          AS duplicate_visit_id

      FROM poi.cities city

      INNER JOIN poi.countries country
        ON country.id = city.country_id

      LEFT JOIN users.collection
        AS user_collection
        ON user_collection.user_id = $1::uuid
        AND user_collection.city_id = city.id

      LEFT JOIN LATERAL (
        SELECT visited_place.id
        FROM users.visited_places
          AS visited_place
        WHERE $4::varchar IS NOT NULL
          AND visited_place.evidence_sha256 =
            $4::varchar
        LIMIT 1
      ) AS duplicate_evidence
        ON TRUE

      WHERE (
          $2::uuid IS NOT NULL
          AND city.id = $2::uuid
        )
        OR (
          $3::varchar IS NOT NULL
          AND city.provider = 'GOOGLE_PLACES'
          AND city.provider_id = $3::varchar
        )

      LIMIT 1
    `;

    const { rows } = await client.query(
      sql,
      [
        userId,
        cityId,
        googleCityPlaceId,
        evidenceSha256,
      ],
    );

    return rows[0] ?? null;
  }

  async findVerificationContext({
    userId,
    placeId = null,
    googlePlaceId = null,
    googleCityPlaceId = null,
    evidenceSha256,
  }) {
    const sql = `
      WITH requested_input AS (
        SELECT
          $1::uuid
            AS user_id,

          $2::uuid
            AS place_id,

          $3::varchar
            AS google_place_id,

          $4::varchar
            AS google_city_place_id,

          $5::varchar
            AS evidence_sha256
      )

      SELECT
        place.id
          AS place_id,

        place.name
          AS place_name,

        place.latitude
          AS place_latitude,

        place.longitude
          AS place_longitude,

        place.is_verified
          AS place_is_verified,

        place.is_closed
          AS place_is_closed,

        place.media_id
          AS place_media_id,

        city.id
          AS city_id,

        city.name
          AS city_name,

              city.official_name
          AS city_official_name,

        city.icon_asset_id
          AS city_icon_asset_id,

        city.is_active

          AS city_is_active,

        country.id
          AS country_id,

        country.name
          AS country_name,

        (
          place.id IS NOT NULL
        ) AS place_exists,

        (
          place.id IS NOT NULL
          AND place.is_verified
            IS TRUE
          AND place.is_closed
            IS FALSE
          AND city.id IS NOT NULL
          AND city.is_active
            IS TRUE
          AND (
            requested_input
                .google_city_place_id
              IS NULL
            OR (
              city.provider =
                'GOOGLE_PLACES'
              AND city.provider_id =
                requested_input
                  .google_city_place_id
            )
          )
          AND place.latitude
            IS NOT NULL
          AND place.longitude
            IS NOT NULL
        ) AS place_available,

        existing_visit.id
          AS existing_visit_id,

        existing_visit
          .verification_status
          AS existing_visit_status,

        existing_collection.id
          AS existing_collection_id,

        duplicate_evidence.id
          AS duplicate_visit_id,

        duplicate_evidence.user_id
          AS duplicate_user_id,

        duplicate_evidence.place_id
          AS duplicate_place_id

      FROM requested_input

      LEFT JOIN poi.places
        AS place
        ON (
          requested_input.place_id
            IS NOT NULL
          AND place.id =
            requested_input.place_id
        )
        OR (
          requested_input.google_place_id
            IS NOT NULL
          AND place.provider =
            'GOOGLE_PLACES'
          AND place.provider_id =
            requested_input.google_place_id
        )

      LEFT JOIN poi.cities
        AS city
        ON city.id =
          place.city_id

      LEFT JOIN poi.countries
        AS country
        ON country.id =
          place.country_id

      LEFT JOIN LATERAL (
        SELECT
          visited_place.id,
          visited_place
            .verification_status

        FROM users.visited_places
          AS visited_place

        WHERE visited_place.user_id =
            requested_input.user_id

          AND visited_place.place_id =
            place.id

        LIMIT 1
      ) AS existing_visit
        ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          user_collection.id

        FROM users.collection
          AS user_collection

        WHERE user_collection.user_id =
            requested_input.user_id

          AND user_collection.city_id =
            city.id

        LIMIT 1
      ) AS existing_collection
        ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          visited_place.id,
          visited_place.user_id,
          visited_place.place_id

        FROM users.visited_places
          AS visited_place

        WHERE requested_input
                .evidence_sha256
              IS NOT NULL

          AND visited_place
                .evidence_sha256 =
              requested_input
                .evidence_sha256

        LIMIT 1
      ) AS duplicate_evidence
        ON TRUE
    `;

    const {
      rows,
    } = await Database.query(
      sql,
      [
        userId,
        placeId,
        googlePlaceId,
        googleCityPlaceId,
        evidenceSha256,
      ],
    );

    return rows[0] ?? null;
  }

  async saveVerifiedVisit({
    client,
    userId,
    placeId,
    verificationAssetId,
    claimedVisitedAt = null,
    evidenceCapturedAt,
    evidenceLatitude,
    evidenceLongitude,
    evidenceSha256,
    evidencePerceptualHash = null,
    visitedAt,
    verificationDetails,
  }) {
    const sql = `
      WITH visit_lock AS MATERIALIZED (
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              $1::uuid::text
              || ':'
              || $2::uuid::text,
              0
            )
          )
      ),

      eligible_context
        AS MATERIALIZED (
        SELECT
          place.id
            AS place_id,

          place.name
            AS place_name,

          place.city_id,

          city.name
            AS city_name,

                    city.official_name
            AS city_official_name,

          city.icon_asset_id
            AS city_icon_asset_id,

          country.id

            AS country_id,

          country.name
            AS country_name,

          asset.id
            AS verification_asset_id

        FROM visit_lock

        INNER JOIN poi.places
          AS place
          ON place.id =
            $2::uuid

         AND place.is_verified
           IS TRUE

         AND place.is_closed
           IS FALSE

         AND place.latitude
           IS NOT NULL

         AND place.longitude
           IS NOT NULL

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

        INNER JOIN media.assets
          AS asset
          ON asset.id =
            $3::uuid

         AND asset.uploaded_by =
            $1::uuid

         AND asset.deleted_at
           IS NULL

         AND LOWER(
               asset.mime_type
             ) LIKE 'image/%'

        FOR KEY SHARE OF
          place,
          city,
          asset
      ),

      existing_visit
        AS MATERIALIZED (
        SELECT
          visited_place.id,
          visited_place.user_id,
          visited_place.place_id,
          visited_place.collections_id,
          visited_place
            .verification_asset_id,
          visited_place
            .verification_status,
          visited_place.visit_source,
          visited_place.visited_at,
          visited_place.claimed_visited_at,
          visited_place.evidence_captured_at,
          visited_place.evidence_latitude,
          visited_place.evidence_longitude,
          visited_place.evidence_sha256,
          visited_place
            .evidence_perceptual_hash,
          visited_place.verification_details,
          visited_place.created_at,
          visited_place.updated_at

        FROM users.visited_places
          AS visited_place

        CROSS JOIN visit_lock

        WHERE visited_place.user_id =
            $1::uuid

          AND visited_place.place_id =
            $2::uuid

        LIMIT 1

        FOR UPDATE
      ),

      verified_collection AS (
        INSERT INTO users.collection
          AS user_collection (
            user_id,
            city_id,
            collections_name,
            icon_asset_id,
            verification_asset_id,
            verification_status,
            visited_at,
            is_preference
          )

        SELECT
          $1::uuid,
          eligible_context.city_id,
                eligible_context.city_name,
          eligible_context
            .city_icon_asset_id,
          eligible_context
            .verification_asset_id,
          TRUE,
          $10::timestamptz,
          FALSE

        FROM eligible_context

        ON CONFLICT (
          user_id,
          city_id
        )
        DO UPDATE SET
          collections_name =
            EXCLUDED.collections_name,

          icon_asset_id =
            COALESCE(
              user_collection
                .icon_asset_id,
              EXCLUDED.icon_asset_id
            ),

          verification_asset_id =
            COALESCE(
              user_collection
                .verification_asset_id,
              EXCLUDED
                .verification_asset_id
            ),

          verification_status =
            TRUE,

          visited_at =
            CASE
              WHEN user_collection
                     .visited_at
                   IS NULL
                THEN EXCLUDED.visited_at

              WHEN EXCLUDED.visited_at
                   IS NULL
                THEN user_collection
                       .visited_at

              ELSE LEAST(
                user_collection
                  .visited_at,
                EXCLUDED.visited_at
              )
            END

        RETURNING
          user_collection.id,
          user_collection.user_id,
          user_collection.city_id,
          user_collection.collections_name,
          user_collection.icon_asset_id,
          user_collection
            .verification_asset_id,
          user_collection
            .verification_status,
          user_collection.visited_at,
          user_collection.is_preference
      ),

      inserted_visit AS (
        INSERT INTO users.visited_places (
          user_id,
          place_id,
          collections_id,
          verification_asset_id,
          verification_status,
          visit_source,
          visited_at,
          claimed_visited_at,
          evidence_captured_at,
          evidence_latitude,
          evidence_longitude,
          evidence_sha256,
          evidence_perceptual_hash,
          verification_details
        )

        SELECT
          $1::uuid,
          eligible_context.place_id,
          verified_collection.id,
          eligible_context
            .verification_asset_id,
          'VERIFIED',
          'PHOTO_VERIFICATION',
          $10::timestamptz,
          $4::timestamptz,
          $5::timestamptz,
          $6::double precision,
          $7::double precision,
          $8::varchar,
          $9::varchar,
          $11::jsonb

        FROM eligible_context

        INNER JOIN verified_collection
          ON verified_collection.city_id =
            eligible_context.city_id

        WHERE NOT EXISTS (
          SELECT 1
          FROM existing_visit
        )

        RETURNING
          users.visited_places.id,
          users.visited_places.user_id,
          users.visited_places.place_id,
          users.visited_places
            .collections_id,
          users.visited_places
            .verification_asset_id,
          users.visited_places
            .verification_status,
          users.visited_places.visit_source,
          users.visited_places.visited_at,
          users.visited_places
            .claimed_visited_at,
          users.visited_places
            .evidence_captured_at,
          users.visited_places
            .evidence_latitude,
          users.visited_places
            .evidence_longitude,
          users.visited_places
            .evidence_sha256,
          users.visited_places
            .evidence_perceptual_hash,
          users.visited_places
            .verification_details,
          users.visited_places.created_at,
          users.visited_places.updated_at
      ),

      final_visit AS (
        SELECT
          inserted_visit.*,
          TRUE AS visit_created

        FROM inserted_visit

        UNION ALL

        SELECT
          existing_visit.*,
          FALSE AS visit_created

        FROM existing_visit

        WHERE NOT EXISTS (
          SELECT 1
          FROM inserted_visit
        )
      )

      SELECT
        final_visit.*,

        verified_collection.id
          AS collection_id,

        verified_collection.city_id,
        verified_collection
          .collections_name
          AS city_name,

        verified_collection.icon_asset_id,
        verified_collection
          .verification_status
          AS collection_verified,

        verified_collection.visited_at
          AS collection_visited_at,

        verified_collection.is_preference,

        eligible_context.place_name,
        eligible_context.city_official_name,
        eligible_context.country_id,
        eligible_context.country_name

      FROM final_visit

      INNER JOIN verified_collection
        ON verified_collection.id =
          final_visit.collections_id

      INNER JOIN eligible_context
        ON eligible_context.place_id =
          final_visit.place_id

      LIMIT 1
    `;

    const {
      rows,
    } = await client.query(
      sql,
      [
        userId,
        placeId,
        verificationAssetId,
        claimedVisitedAt,
        evidenceCapturedAt,
        evidenceLatitude,
        evidenceLongitude,
        evidenceSha256,
        evidencePerceptualHash,
        visitedAt,
        JSON.stringify(
          verificationDetails ?? {},
        ),
      ],
    );

    return rows[0] ?? null;
  }

  async saveVerifiedCity({
    client,
    userId,
    cityId,
    verificationAssetId,
    visitedAt,
  }) {
    const sql = `
      WITH city_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            $1::uuid::text || ':' ||
            $2::uuid::text,
            0
          )
        )
      ),
      eligible_context AS MATERIALIZED (
        SELECT
          city.id AS city_id,
          city.name AS city_name,
          city.official_name
            AS city_official_name,
          city.icon_asset_id,
          country.id AS country_id,
          country.name AS country_name,
          asset.id AS verification_asset_id
        FROM city_lock
        INNER JOIN poi.cities city
          ON city.id = $2::uuid
          AND city.is_active IS TRUE
        INNER JOIN poi.countries country
          ON country.id = city.country_id
        INNER JOIN media.assets asset
          ON asset.id = $3::uuid
          AND asset.uploaded_by = $1::uuid
          AND asset.deleted_at IS NULL
          AND LOWER(asset.mime_type)
            LIKE 'image/%'
        FOR KEY SHARE OF city, asset
      ),
      verified_collection AS (
        INSERT INTO users.collection
          AS user_collection (
            user_id,
            city_id,
            collections_name,
            icon_asset_id,
            verification_asset_id,
            verification_status,
            visited_at,
            is_preference
          )
        SELECT
          $1::uuid,
          eligible_context.city_id,
          eligible_context.city_name,
          eligible_context.icon_asset_id,
          eligible_context.verification_asset_id,
          TRUE,
          $4::timestamptz,
          FALSE
        FROM eligible_context
        ON CONFLICT (user_id, city_id)
        DO UPDATE SET
          collections_name =
            EXCLUDED.collections_name,
          icon_asset_id = COALESCE(
            user_collection.icon_asset_id,
            EXCLUDED.icon_asset_id
          ),
          verification_asset_id =
            EXCLUDED.verification_asset_id,
          verification_status = TRUE,
          visited_at = COALESCE(
            user_collection.visited_at,
            EXCLUDED.visited_at
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_collection
                .verification_status
              IS FALSE
        RETURNING user_collection.*
      )
      SELECT
        verified_collection.*,
        eligible_context.city_name,
        eligible_context.city_official_name,
        eligible_context.country_id,
        eligible_context.country_name,
        TRUE AS collection_created
      FROM verified_collection
      INNER JOIN eligible_context
        ON eligible_context.city_id =
          verified_collection.city_id
      LIMIT 1
    `;

    const { rows } = await client.query(
      sql,
      [
        userId,
        cityId,
        verificationAssetId,
        visitedAt,
      ],
    );

    return rows[0] ?? null;
  }

  async updateCollectionPreference({
    userId,
    collectionId,
    isPreference,
  }) {
    const sql = `
      WITH updated_collection AS (
        UPDATE users.collection
          AS user_collection

        SET
          is_preference =
            $3::boolean,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE user_collection.id =
            $2::uuid

          AND user_collection.user_id =
            $1::uuid

          AND user_collection
                .verification_status
              IS TRUE

        RETURNING
          user_collection.id,
          user_collection.user_id,
          user_collection.city_id,
          user_collection.collections_name,
          user_collection
            .verification_status,
          user_collection.visited_at,
          user_collection.is_preference,
          user_collection.created_at,
          user_collection.updated_at
      )

      SELECT
        updated_collection.*,

        city.name
          AS city_name,

        city.official_name
          AS city_official_name,

        country.id
          AS country_id,

        country.name
          AS country_name,

        city.icon_asset_id,

        icon_asset.storage_provider
          AS icon_storage_provider,

        icon_asset.bucket
          AS icon_bucket,

        icon_asset.storage_key
          AS icon_storage_key,

        icon_asset.mime_type
          AS icon_mime_type,

        icon_asset.is_public
          AS icon_is_public

      FROM updated_collection

      INNER JOIN poi.cities
        AS city
        ON city.id =
          updated_collection.city_id

      INNER JOIN poi.countries
        AS country
        ON country.id =
          city.country_id

      LEFT JOIN media.assets
        AS icon_asset
        ON icon_asset.id =
          city.icon_asset_id

       AND icon_asset.deleted_at
         IS NULL

      LIMIT 1
    `;

    const {
      rows,
    } = await Database.query(
      sql,
      [
        userId,
        collectionId,
        isPreference,
      ],
    );

    return rows[0] ?? null;
  }
  

    /**
   * Lists the authenticated user's verified
   * visited places using stable keyset pagination.
   */
  async listVisitedPlaces({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1,
        ),
        50,
      );

    const params = [
      userId,
    ];

    let cursorWhere = "";

    if (cursor) {
      params.push(
        cursor.visitedAt,
      );

      params.push(
        cursor.id,
      );

      cursorWhere = `
        AND (
          visited_place.visited_at,
          visited_place.id
        ) < (
          $2::timestamptz,
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
        visited_place.id,
        visited_place.user_id,
        visited_place.place_id,
        visited_place.collections_id,
        visited_place.verification_status,
        visited_place.visit_source,
        visited_place.visited_at,
        visited_place.claimed_visited_at,
        visited_place.evidence_captured_at,
        visited_place.created_at,
        visited_place.updated_at,

        visited_place.visited_at::text
          AS cursor_visited_at,

        place.name
          AS place_name,

        place.latitude
          AS place_latitude,

        place.longitude
          AS place_longitude,

        user_collection.id
          AS collection_id,

        user_collection
          .verification_status
          AS collection_verified,

        user_collection.is_preference,

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

        city.icon_asset_id,

        icon_asset.storage_provider
          AS icon_storage_provider,

        icon_asset.bucket
          AS icon_bucket,

        icon_asset.storage_key
          AS icon_storage_key,

        icon_asset.mime_type
          AS icon_mime_type,

        icon_asset.is_public
          AS icon_is_public

      FROM users.visited_places
        AS visited_place

      INNER JOIN users.collection
        AS user_collection
        ON user_collection.id =
          visited_place.collections_id

       AND user_collection.user_id =
          visited_place.user_id

      INNER JOIN poi.places
        AS place
        ON place.id =
          visited_place.place_id

      INNER JOIN poi.cities
        AS city
        ON city.id =
          user_collection.city_id

       AND city.id =
          place.city_id

      INNER JOIN poi.countries
        AS country
        ON country.id =
          city.country_id

      LEFT JOIN media.assets
        AS icon_asset
        ON icon_asset.id =
          city.icon_asset_id

       AND icon_asset.deleted_at
         IS NULL

      WHERE visited_place.user_id =
          $1::uuid

        AND visited_place
              .verification_status =
            'VERIFIED'

        AND user_collection
              .verification_status
            IS TRUE

        ${cursorWhere}

      ORDER BY
        visited_place.visited_at DESC,
        visited_place.id DESC

      LIMIT $${limitParameterIndex}
    `;

    const {
      rows,
    } = await Database.query(
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

export default
  new VisitedPlacesRepository();
