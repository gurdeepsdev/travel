import Database from "../../database/database-manager.js";

class ItineraryRepository {
  async listOwned({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const safeLimit = Math.min(
      Math.max(
        Number(limit) || 20,
        1,
      ),
      50,
    );

    const params = [userId];
    let cursorCondition = "";

    if (cursor) {
      params.push(
        cursor.createdAt,
        cursor.id,
      );

      cursorCondition = `
        AND (
          created_at,
          id
        ) < (
          $2::timestamp,
          $3::uuid
        )
      `;
    }

    params.push(safeLimit + 1);

    const sql = `
      SELECT
        id,
        created_by,
        title,
        duration_days,
        visibility,
        trip_status,
        ai_generated,
        created_at,
        updated_at,
        created_at::text
          AS cursor_created_at
      FROM itinerary.itineraries
      WHERE created_by = $1::uuid
        AND deleted_at IS NULL
        ${cursorCondition}
      ORDER BY
        created_at DESC,
        id DESC
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
