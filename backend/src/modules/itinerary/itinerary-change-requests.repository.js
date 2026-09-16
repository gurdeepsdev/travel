import Database from "../../database/database-manager.js";

const ACCESS_SQL = `
  itinerary_record.created_by = $2::uuid
  OR EXISTS (
    SELECT 1
    FROM groups.groups linked_group
    LEFT JOIN groups.group_members member
      ON member.group_id = linked_group.id
      AND member.user_id = $2::uuid
      AND member.status = 'ACTIVE'
    WHERE linked_group.itinerary_id = itinerary_record.id
      AND linked_group.status = 'ACTIVE'
      AND linked_group.deleted_at IS NULL
      AND (
        linked_group.owner_id = $2::uuid
        OR member.id IS NOT NULL
      )
  )
`;

const SELECT_FIELDS = `
  request.id,
  request.itinerary_id,
  request.requested_by,
  request.request_type,
  request.proposed_data,
  request.message,
  request.status,
  request.reviewed_by,
  request.reviewed_at,
  request.review_message,
  request.base_itinerary_updated_at,
  request.created_at,
  request.updated_at,
  requester.username AS requester_username,
  requester.display_name AS requester_display_name,
  reviewer.username AS reviewer_username,
  reviewer.display_name AS reviewer_display_name
`;

class ItineraryChangeRequestsRepository {
  async canAccess({ itineraryId, userId }) {
    const { rows } = await Database.query(`
      SELECT 1
      FROM itinerary.itineraries itinerary_record
      WHERE itinerary_record.id = $1::uuid
        AND itinerary_record.deleted_at IS NULL
        AND (${ACCESS_SQL})
    `, [itineraryId, userId]);
    return Boolean(rows[0]);
  }

  async create({ itineraryId, userId, proposedData, message }) {
    const { rows } = await Database.query(`
      INSERT INTO itinerary.itinerary_change_requests(
        itinerary_id,
        requested_by,
        request_type,
        proposed_data,
        message,
        base_itinerary_updated_at
      )
      SELECT
        itinerary_record.id,
        $2::uuid,
        'UPDATE_ITINERARY',
        $3::jsonb,
        $4,
        itinerary_record.updated_at
      FROM itinerary.itineraries itinerary_record
      JOIN groups.groups linked_group
        ON linked_group.itinerary_id = itinerary_record.id
        AND linked_group.status = 'ACTIVE'
        AND linked_group.deleted_at IS NULL
      LEFT JOIN groups.group_members member
        ON member.group_id = linked_group.id
        AND member.user_id = $2::uuid
        AND member.status = 'ACTIVE'
      LEFT JOIN itinerary.user_itinerary_states owner_state
        ON owner_state.itinerary_id = itinerary_record.id
        AND owner_state.user_id = itinerary_record.created_by
      WHERE itinerary_record.id = $1::uuid
        AND itinerary_record.deleted_at IS NULL
        AND itinerary_record.created_by <> $2::uuid
        AND (
          linked_group.owner_id = $2::uuid
          OR member.id IS NOT NULL
        )
        AND COALESCE(owner_state.status, 'PLANNED') IN (
          'PLANNED', 'UPCOMING', 'LIVE'
        )
      RETURNING *
    `, [
      itineraryId,
      userId,
      JSON.stringify(proposedData),
      message ?? null,
    ]);

    return rows[0] ?? null;
  }

  async list({ itineraryId, userId, status, limit, cursor }) {
    if (!await this.canAccess({ itineraryId, userId })) {
      return null;
    }
    const { rows } = await Database.query(`
      SELECT ${SELECT_FIELDS}
      FROM itinerary.itinerary_change_requests request
      JOIN itinerary.itineraries itinerary_record
        ON itinerary_record.id = request.itinerary_id
        AND itinerary_record.deleted_at IS NULL
      JOIN users.profiles requester
        ON requester.user_id = request.requested_by
      LEFT JOIN users.profiles reviewer
        ON reviewer.user_id = request.reviewed_by
      WHERE request.itinerary_id = $1::uuid
        AND (${ACCESS_SQL})
        AND ($3::text IS NULL OR request.status = $3)
        AND (
          $4::timestamp IS NULL
          OR (request.created_at, request.id) <
            ($4::timestamp, $5::uuid)
        )
      ORDER BY request.created_at DESC, request.id DESC
      LIMIT $6
    `, [
      itineraryId,
      userId,
      status ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    ]);

    return {
      rows: rows.slice(0, limit),
      hasMore: rows.length > limit,
    };
  }

  async findById({ itineraryId, requestId, userId }) {
    const { rows } = await Database.query(`
      SELECT ${SELECT_FIELDS}
      FROM itinerary.itinerary_change_requests request
      JOIN itinerary.itineraries itinerary_record
        ON itinerary_record.id = request.itinerary_id
        AND itinerary_record.deleted_at IS NULL
      JOIN users.profiles requester
        ON requester.user_id = request.requested_by
      LEFT JOIN users.profiles reviewer
        ON reviewer.user_id = request.reviewed_by
      WHERE request.itinerary_id = $1::uuid
        AND request.id = $3::uuid
        AND (${ACCESS_SQL})
      LIMIT 1
    `, [itineraryId, userId, requestId]);

    return rows[0] ?? null;
  }

  async review({ itineraryId, requestId, userId, decision, message }) {
    return Database.transaction(async (client) => {
      const { rows: [itineraryRecord] } = await client.query(`
        SELECT
          itinerary_record.*,
          COALESCE(owner_state.status, 'PLANNED') AS owner_status
        FROM itinerary.itineraries itinerary_record
        LEFT JOIN itinerary.user_itinerary_states owner_state
          ON owner_state.itinerary_id = itinerary_record.id
          AND owner_state.user_id = itinerary_record.created_by
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.created_by = $2::uuid
          AND itinerary_record.deleted_at IS NULL
        FOR UPDATE OF itinerary_record
      `, [itineraryId, userId]);

      if (!itineraryRecord) { return null; }

      const { rows: [request] } = await client.query(`
        SELECT *
        FROM itinerary.itinerary_change_requests
        WHERE id = $2::uuid
          AND itinerary_id = $1::uuid
        FOR UPDATE
      `, [itineraryId, requestId]);

      if (!request || request.status !== "PENDING") {
        return { unavailable: true };
      }

      if (decision === "REJECTED") {
        const { rows: [rejected] } = await client.query(`
          UPDATE itinerary.itinerary_change_requests
          SET status = 'REJECTED',
              reviewed_by = $3::uuid,
              reviewed_at = CURRENT_TIMESTAMP,
              review_message = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE itinerary_id = $1::uuid
            AND id = $2::uuid
          RETURNING *
        `, [itineraryId, requestId, userId, message ?? null]);
        return { request: rejected };
      }

      if (
        !["PLANNED", "UPCOMING", "LIVE"].includes(
          itineraryRecord.owner_status,
        ) ||
        !Array.isArray(request.proposed_data?.days) ||
        !Number.isInteger(request.proposed_data?.totalPlaces) ||
        itineraryRecord.updated_at.getTime() !==
          request.base_itinerary_updated_at.getTime()
      ) {
        const { rows: [stale] } = await client.query(`
          UPDATE itinerary.itinerary_change_requests
          SET status = 'STALE',
              reviewed_by = $3::uuid,
              reviewed_at = CURRENT_TIMESTAMP,
              review_message = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE itinerary_id = $1::uuid
            AND id = $2::uuid
          RETURNING *
        `, [itineraryId, requestId, userId, message ?? null]);
        return { request: stale, stale: true };
      }

      const { rows: [membership] } = await client.query(`
        SELECT 1
        FROM groups.groups linked_group
        LEFT JOIN groups.group_members member
          ON member.group_id = linked_group.id
          AND member.user_id = $2::uuid
          AND member.status = 'ACTIVE'
        WHERE linked_group.itinerary_id = $1::uuid
          AND linked_group.status = 'ACTIVE'
          AND linked_group.deleted_at IS NULL
          AND (
            linked_group.owner_id = $2::uuid
            OR member.id IS NOT NULL
          )
      `, [itineraryId, request.requested_by]);

      if (!membership) {
        return { unavailable: true };
      }

      const days = request.proposed_data.days;
      const totalPlaces = request.proposed_data.totalPlaces;

      const { rows: [updatedItinerary] } = await client.query(`
        UPDATE itinerary.itineraries
        SET itinerary_json = jsonb_set(
              jsonb_set(
                jsonb_set(
                  itinerary_json,
                  '{days}',
                  $3::jsonb,
                  true
                ),
                '{summary,num_days}',
                to_jsonb($4::integer),
                true
              ),
              '{summary,total_places}',
              to_jsonb($5::integer),
              true
            ),
            duration_days = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
          AND created_by = $2::uuid
        RETURNING id, updated_at
      `, [
        itineraryId,
        userId,
        JSON.stringify(days),
        days.length,
        totalPlaces,
      ]);

      const { rows: [accepted] } = await client.query(`
        UPDATE itinerary.itinerary_change_requests
        SET status = 'ACCEPTED',
            reviewed_by = $3::uuid,
            reviewed_at = CURRENT_TIMESTAMP,
            review_message = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE itinerary_id = $1::uuid
          AND id = $2::uuid
        RETURNING *
      `, [itineraryId, requestId, userId, message ?? null]);

      await client.query(`
        UPDATE itinerary.itinerary_change_requests
        SET status = 'STALE',
            updated_at = CURRENT_TIMESTAMP
        WHERE itinerary_id = $1::uuid
          AND id <> $2::uuid
          AND status = 'PENDING'
      `, [itineraryId, requestId]);

      return {
        request: accepted,
        itinerary: updatedItinerary,
      };
    });
  }

  async cancel({ itineraryId, requestId, userId }) {
    const { rows } = await Database.query(`
      UPDATE itinerary.itinerary_change_requests request
      SET status = 'CANCELLED',
          updated_at = CURRENT_TIMESTAMP
      FROM itinerary.itineraries itinerary_record
      WHERE request.id = $2::uuid
        AND request.itinerary_id = $1::uuid
        AND request.requested_by = $3::uuid
        AND request.status = 'PENDING'
        AND itinerary_record.id = request.itinerary_id
        AND itinerary_record.deleted_at IS NULL
      RETURNING request.*
    `, [itineraryId, requestId, userId]);

    return rows[0] ?? null;
  }
}

export default new ItineraryChangeRequestsRepository();
