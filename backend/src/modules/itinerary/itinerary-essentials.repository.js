import Database from "../../database/database-manager.js";

class ItineraryEssentialsRepository {
  async getEmergencyContacts({ itineraryId, userId }) {
    const { rows } = await Database.query(`
      WITH destination AS (
        SELECT trim(itinerary_json->>'city_id') AS city_identifier
        FROM itinerary.itineraries
        WHERE id=$1::uuid AND created_by=$2::uuid AND deleted_at IS NULL
      ), countries AS (
        SELECT DISTINCT country.id, country.name
        FROM destination d
        JOIN poi.cities city ON city.is_active AND (
          city.id::text=lower(d.city_identifier)
          OR (city.provider='GOOGLE_PLACES' AND city.provider_id=d.city_identifier)
        )
        JOIN poi.countries country ON country.id=city.country_id AND country.is_active
      )
      SELECT c.id,c.name, COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id',e.id,'serviceType',e.service_type,'name',e.name,
          'phoneNumber',e.phone_number,'notes',e.notes,
          'sourceUrl',e.source_url,'verifiedAt',e.verified_at
        ) ORDER BY e.service_type,e.name,e.id)
        FROM poi.country_emergency_contacts e WHERE e.country_id=c.id AND e.is_active
      ),'[]'::jsonb) AS contacts FROM countries c
    `, [itineraryId, userId]);
    if (rows.length !== 1) {
      return { resolutionStatus: 'UNRESOLVED', countries: [] };
    }
    return { resolutionStatus: 'RESOLVED', countries: rows };
  }

  async findOwnedItineraryTrip({
    itineraryId,
    userId,
  }) {
    const { rows } = await Database.query(
      `
        SELECT
          itinerary_record.id AS itinerary_id,
          trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary_record
        LEFT JOIN trip.trips trip_record
          ON trip_record.itinerary_id =
            itinerary_record.id
          AND trip_record.user_id = $2::uuid
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.created_by = $2::uuid
          AND itinerary_record.deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, userId],
    );

    return rows[0] ?? null;
  }

  async create({
    tripId,
    userId,
    input,
  }) {
    const { rows } = await Database.query(
      `
        INSERT INTO trip.trip_essentials (
          trip_id,
          owner_id,
          title,
          category,
          display_order
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5
        )
        RETURNING *
      `,
      [
        tripId,
        userId,
        input.title,
        input.category,
        input.displayOrder ?? 1,
      ],
    );

    return rows[0];
  }

  async listOwned({
    itineraryId,
    userId,
  }) {
    const { rows } = await Database.query(
      `
        SELECT essential.*
        FROM trip.trip_essentials essential
        INNER JOIN trip.trips trip_record
          ON trip_record.id = essential.trip_id
          AND trip_record.user_id = $2::uuid
        INNER JOIN itinerary.itineraries
          AS itinerary_record
          ON itinerary_record.id =
            trip_record.itinerary_id
          AND itinerary_record.created_by =
            $2::uuid
          AND itinerary_record.deleted_at IS NULL
        WHERE itinerary_record.id = $1::uuid
          AND essential.owner_id = $2::uuid
        ORDER BY
          essential.display_order ASC,
          essential.created_at ASC,
          essential.id ASC
      `,
      [itineraryId, userId],
    );

    return rows;
  }

  async updateOwned({
    itineraryId,
    essentialId,
    userId,
    input,
  }) {
    const { rows } = await Database.query(
      `
        UPDATE trip.trip_essentials essential
        SET
          title = COALESCE(
            $4::varchar,
            essential.title
          ),
          category = COALESCE(
            $5::varchar,
            essential.category
          ),
          display_order = COALESCE(
            $6::smallint,
            essential.display_order
          ),
          updated_at = CURRENT_TIMESTAMP
        FROM trip.trips trip_record,
          itinerary.itineraries itinerary_record
        WHERE essential.id = $2::uuid
          AND essential.owner_id = $3::uuid
          AND trip_record.id = essential.trip_id
          AND trip_record.user_id = $3::uuid
          AND itinerary_record.id = $1::uuid
          AND itinerary_record.id =
            trip_record.itinerary_id
          AND itinerary_record.created_by = $3::uuid
          AND itinerary_record.deleted_at IS NULL
        RETURNING essential.*
      `,
      [
        itineraryId,
        essentialId,
        userId,
        input.title ?? null,
        input.category ?? null,
        input.displayOrder ?? null,
      ],
    );

    return rows[0] ?? null;
  }

  async setSelectionOwned({
    itineraryId,
    essentialId,
    userId,
    selected,
  }) {
    const { rows } = await Database.query(
      `
        UPDATE trip.trip_essentials essential
        SET
          is_completed = $4::boolean,
          updated_at = CURRENT_TIMESTAMP
        FROM trip.trips trip_record,
          itinerary.itineraries itinerary_record
        WHERE essential.id = $2::uuid
          AND essential.owner_id = $3::uuid
          AND trip_record.id = essential.trip_id
          AND trip_record.user_id = $3::uuid
          AND itinerary_record.id = $1::uuid
          AND itinerary_record.id =
            trip_record.itinerary_id
          AND itinerary_record.created_by = $3::uuid
          AND itinerary_record.deleted_at IS NULL
        RETURNING essential.*
      `,
      [
        itineraryId,
        essentialId,
        userId,
        selected,
      ],
    );

    return rows[0] ?? null;
  }

  async deleteOwned({
    itineraryId,
    essentialId,
    userId,
  }) {
    const { rows } = await Database.query(
      `
        DELETE FROM trip.trip_essentials essential
        USING trip.trips trip_record,
          itinerary.itineraries itinerary_record
        WHERE essential.id = $2::uuid
          AND essential.owner_id = $3::uuid
          AND trip_record.id = essential.trip_id
          AND trip_record.user_id = $3::uuid
          AND itinerary_record.id = $1::uuid
          AND itinerary_record.id =
            trip_record.itinerary_id
          AND itinerary_record.created_by = $3::uuid
          AND itinerary_record.deleted_at IS NULL
        RETURNING essential.id
      `,
      [itineraryId, essentialId, userId],
    );

    return rows[0] ?? null;
  }
}

export default new ItineraryEssentialsRepository();
