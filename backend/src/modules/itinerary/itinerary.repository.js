import Database from "../../database/database-manager.js";

class ItineraryRepository {
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
