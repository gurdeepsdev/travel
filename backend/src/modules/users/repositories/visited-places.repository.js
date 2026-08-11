import Database
  from "../../../database/database-manager.js";

class VisitedPlacesRepository {
  async findVerificationContext({
    userId,
    placeId,
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
        ON place.id =
          requested_input.place_id

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
            requested_input.place_id

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
