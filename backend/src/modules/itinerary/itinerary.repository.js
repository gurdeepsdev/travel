import Database from "../../database/database-manager.js";

class ItineraryRepository {
  async getOrCreateOwnedPublicShare({
    itineraryId,
    userId,
    shareToken,
  }) {
    return Database.transaction(
      async (client) => {
        await client.query(
          `
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                $1::text,
                0
              )
            )
          `,
          [itineraryId],
        );

        const itineraryResult =
          await client.query(
            `
              SELECT id
              FROM itinerary.itineraries
              WHERE id = $1::uuid
                AND created_by = $2::uuid
                AND deleted_at IS NULL
              LIMIT 1
            `,
            [itineraryId, userId],
          );

        if (!itineraryResult.rows[0]) {
          return null;
        }

        const existingResult =
          await client.query(
            `
              SELECT
                id,
                itinerary_id,
                share_token,
                access_type,
                expires_at,
                created_at
              FROM itinerary.itinerary_shares
              WHERE itinerary_id = $1::uuid
                AND created_by = $2::uuid
                AND access_type = 'public'
                AND is_active = TRUE
                AND (
                  expires_at IS NULL
                  OR expires_at >
                    CURRENT_TIMESTAMP
                )
              ORDER BY created_at DESC
              LIMIT 1
              FOR UPDATE
            `,
            [itineraryId, userId],
          );

        if (existingResult.rows[0]) {
          return existingResult.rows[0];
        }

        const createdResult =
          await client.query(
            `
              INSERT INTO itinerary.itinerary_shares (
                itinerary_id,
                share_token,
                access_type,
                created_by
              )
              VALUES (
                $1::uuid,
                $3,
                'public',
                $2::uuid
              )
              RETURNING
                id,
                itinerary_id,
                share_token,
                access_type,
                expires_at,
                created_at
            `,
            [
              itineraryId,
              userId,
              shareToken,
            ],
          );

        return createdResult.rows[0];
      },
    );
  }

  async updateOwnedName({
    itineraryId,
    userId,
    name,
  }) {
    const { rows } =
      await Database.query(
        `
          UPDATE itinerary.itineraries
          SET
            title = $3,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1::uuid
            AND created_by = $2::uuid
            AND deleted_at IS NULL
          RETURNING
            id,
            title,
            updated_at
        `,
        [
          itineraryId,
          userId,
          name,
        ],
      );

    return rows[0] ?? null;
  }

  async softDeleteOwned({
    itineraryId,
    userId,
  }) {
    const { rows } =
      await Database.query(
        `
          UPDATE itinerary.itineraries
          SET
            deleted_at =
              CURRENT_TIMESTAMP,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1::uuid
            AND created_by = $2::uuid
            AND deleted_at IS NULL
          RETURNING
            id,
            deleted_at
        `,
        [
          itineraryId,
          userId,
        ],
      );

    return rows[0] ?? null;
  }

  async replaceOwnedJson({
    itineraryId,
    userId,
    title,
    durationDays,
    itineraryJson,
  }) {
    const { rows } =
      await Database.query(
        `
          UPDATE itinerary.itineraries
          SET
            title = $3,
            duration_days = $4,
            itinerary_json = $5::jsonb,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::uuid
            AND created_by = $2::uuid
            AND deleted_at IS NULL
          RETURNING
            id,
            created_by,
            title,
            duration_days,
            visibility,
            trip_status,
            ai_generated,
            itinerary_json,
            created_at,
            updated_at
        `,
        [
          itineraryId,
          userId,
          title,
          durationDays,
          JSON.stringify(
            itineraryJson,
          ),
        ],
      );

    return rows[0] ?? null;
  }

  async updateOwnedLifecycleStatus({
    itineraryId,
    userId,
    status,
  }) {
    return Database.transaction(
      async (client) => {
        await client.query(
          `
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                $1::text,
                0
              )
            )
          `,
          [itineraryId],
        );

        const { rows } =
          await client.query(
            `
              SELECT
                itinerary.id,
                itinerary.updated_at,
                trip_record.id
                  AS trip_id,
                trip_record.status
                  AS trip_status,
                trip_record.started_at,
                trip_record.completed_at
              FROM itinerary.itineraries
                AS itinerary
              LEFT JOIN trip.trips
                AS trip_record
                ON trip_record.itinerary_id =
                  itinerary.id
              WHERE itinerary.id = $1::uuid
                AND itinerary.created_by =
                  $2::uuid
                AND itinerary.deleted_at
                  IS NULL
              LIMIT 1
            `,
            [
              itineraryId,
              userId,
            ],
          );

        const itinerary =
          rows[0] ?? null;

        if (!itinerary) {
          return null;
        }

        const statusMap = {
          UPCOMING: "UPCOMING",
          ONGOING: "LIVE",
          COMPLETED: "COMPLETED",
          CANCELLED: "CANCELLED",
        };
        const currentStatus =
          itinerary.trip_id
            ? statusMap[
                itinerary.trip_status
              ]
            : "SAVED";

        if (currentStatus === status) {
          return {
            ...itinerary,
            current_status:
              currentStatus,
            previous_status:
              currentStatus,
            updated: false,
          };
        }

        const nextStatus = {
          SAVED: "UPCOMING",
          UPCOMING: "LIVE",
          LIVE: "COMPLETED",
        }[currentStatus];

        if (nextStatus !== status) {
          return {
            invalid_transition: true,
            current_status:
              currentStatus,
          };
        }

        if (status === "UPCOMING") {
          const result =
            await client.query(
              `
                INSERT INTO trip.trips (
                  itinerary_id,
                  user_id,
                  status
                )
                VALUES (
                  $1::uuid,
                  $2::uuid,
                  'UPCOMING'
                )
                RETURNING
                  id AS trip_id,
                  status AS trip_status,
                  started_at,
                  completed_at,
                  updated_at
              `,
              [
                itineraryId,
                userId,
              ],
            );

          return {
            ...result.rows[0],
            id: itinerary.id,
            current_status: status,
            previous_status:
              currentStatus,
            updated: true,
          };
        }

        const databaseStatus =
          status === "LIVE"
            ? "ONGOING"
            : "COMPLETED";
        const itineraryStatus =
          status === "LIVE"
            ? "ongoing"
            : "completed";

        const tripResult =
          await client.query(
            `
              UPDATE trip.trips
              SET
                status = $3,
                started_at = CASE
                  WHEN $3 = 'ONGOING'
                    THEN COALESCE(
                      started_at,
                      CURRENT_TIMESTAMP
                    )
                  ELSE started_at
                END,
                completed_at = CASE
                  WHEN $3 = 'COMPLETED'
                    THEN CURRENT_TIMESTAMP
                  ELSE completed_at
                END,
                updated_at =
                  CURRENT_TIMESTAMP
              WHERE itinerary_id =
                $1::uuid
                AND user_id = $2::uuid
              RETURNING
                id AS trip_id,
                status AS trip_status,
                started_at,
                completed_at,
                updated_at
            `,
            [
              itineraryId,
              userId,
              databaseStatus,
            ],
          );

        await client.query(
          `
            UPDATE itinerary.itineraries
            SET
              trip_status = $3,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1::uuid
              AND created_by = $2::uuid
          `,
          [
            itineraryId,
            userId,
            itineraryStatus,
          ],
        );

        return {
          ...tripResult.rows[0],
          id: itinerary.id,
          current_status: status,
          previous_status:
            currentStatus,
          updated: true,
        };
      },
    );
  }

  async listOwned({
    userId,
    limit = 20,
    cursor = null,
    tripStatus = null,
  }) {
    const safeLimit = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),
      50,
    );

    const params = [userId];
    let statusCondition = "";
    let cursorCondition = "";

    if (tripStatus === "PLANNED") {
      statusCondition = `
        AND trip_record.id IS NULL
      `;
    } else if (tripStatus) {
      const databaseStatus = {
        UPCOMING: "UPCOMING",
        LIVE: "ONGOING",
        COMPLETED: "COMPLETED",
      }[tripStatus];

      params.push(databaseStatus);
      statusCondition = `
        AND trip_record.status =
          $${params.length}::varchar
      `;
    }

    if (cursor) {
      params.push(cursor.createdAt);
      const createdAtParameter =
        params.length;

      params.push(cursor.id);
      const idParameter =
        params.length;

      cursorCondition = `
        AND (
          itinerary_record.created_at,
          itinerary_record.id
        ) < (
          $${createdAtParameter}::timestamp,
          $${idParameter}::uuid
        )
      `;
    }

    params.push(safeLimit + 1);

    const sql = `
      SELECT
        itinerary_record.id,
        itinerary_record.created_by,
        itinerary_record.title,
        itinerary_record.duration_days,
        itinerary_record.visibility,
        CASE
          WHEN trip_record.status =
            'ONGOING'
            THEN 'live'
          WHEN trip_record.status IS NOT NULL
            THEN LOWER(
              trip_record.status
            )
          ELSE 'planned'
        END AS trip_status,
        itinerary_record.ai_generated,
        itinerary_record.itinerary_json,
        itinerary_record.created_at,
        itinerary_record.updated_at,
        itinerary_record.created_at::text
          AS cursor_created_at
      FROM itinerary.itineraries
        AS itinerary_record
      LEFT JOIN trip.trips
        AS trip_record
        ON trip_record.itinerary_id =
          itinerary_record.id
      WHERE itinerary_record.created_by =
          $1::uuid
        AND itinerary_record.deleted_at
          IS NULL
        ${statusCondition}
        ${cursorCondition}
      ORDER BY
        itinerary_record.created_at DESC,
        itinerary_record.id DESC
      LIMIT $${params.length}
    `;

    const { rows } =
      await Database.query(
        sql,
        params,
      );

    const hasMore =
      rows.length > safeLimit;
    const visibleRows =
      hasMore
        ? rows.slice(0, safeLimit)
        : rows;

    return {
      rows: visibleRows,
      hasMore,
      lastRow:
        visibleRows.at(-1) ?? null,
    };
  }

  async findOwnedById({
    itineraryId,
    userId,
  }) {
    const sql = `
      SELECT
        id,
        created_by,
        title,
        duration_days,
        visibility,
        trip_status,
        ai_generated,
        itinerary_json,
        created_at,
        updated_at
      FROM itinerary.itineraries
      WHERE id = $1::uuid
        AND created_by = $2::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          itineraryId,
          userId,
        ],
      );

    return rows[0] ?? null;
  }

  async create({
    userId,
    title,
    durationDays,
    itineraryJson,
  }) {
    const sql = `
      INSERT INTO itinerary.itineraries (
        created_by,
        title,
        duration_days,
        visibility,
        trip_status,
        ai_generated,
        itinerary_json
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        'private',
        'planned',
        TRUE,
        $4::jsonb
      )
      RETURNING
        id,
        created_by,
        title,
        duration_days,
        visibility,
        trip_status,
        ai_generated,
        itinerary_json,
        created_at,
        updated_at
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          title,
          durationDays,
          JSON.stringify(
            itineraryJson,
          ),
        ],
      );

    return rows[0] ?? null;
  }
}

export default new ItineraryRepository();
