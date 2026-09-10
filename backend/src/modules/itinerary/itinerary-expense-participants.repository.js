import Database from "../../database/database-manager.js";

class ItineraryExpenseParticipantsRepository {
  async findOwnedTrip({ itineraryId, ownerUserId }) {
    const { rows } = await Database.query(
      `
        SELECT trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary_record
        LEFT JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary_record.id
          AND trip_record.user_id = $2::uuid
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.created_by = $2::uuid
          AND itinerary_record.deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, ownerUserId],
    );

    return rows[0] ?? null;
  }

  async findActive({ tripId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT id
        FROM trip.trip_participants
        WHERE trip_id = $1::uuid
          AND user_id = $2::uuid
          AND status = 'ACTIVE'
        LIMIT 1
      `,
      [tripId, userId],
    );

    return rows[0] ?? null;
  }

  async findAccessibleTrip({ itineraryId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary_record
        INNER JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary_record.id
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.deleted_at IS NULL
          AND (
            itinerary_record.created_by = $2::uuid
            OR EXISTS (
              SELECT 1
              FROM trip.trip_participants participant
              WHERE participant.trip_id = trip_record.id
                AND participant.user_id = $2::uuid
                AND participant.status = 'ACTIVE'
            )
          )
        LIMIT 1
      `,
      [itineraryId, userId],
    );

    return rows[0] ?? null;
  }

  async listActive({ tripId }) {
    const { rows } = await Database.query(
      `
        SELECT
          participant.*,
          profile.username,
          profile.display_name,
          profile.is_verified,
          profile_photo.id AS profile_photo_id,
          profile_photo.storage_provider AS profile_photo_storage_provider,
          profile_photo.bucket AS profile_photo_bucket,
          profile_photo.storage_key AS profile_photo_storage_key,
          profile_photo.mime_type AS profile_photo_mime_type,
          profile_photo.is_public AS profile_photo_is_public,
          (trip_record.user_id = participant.user_id) AS is_owner
        FROM trip.trip_participants participant
        INNER JOIN trip.trips trip_record
          ON trip_record.id = participant.trip_id
        INNER JOIN users.profiles profile
          ON profile.user_id = participant.user_id
          AND profile.deleted_at IS NULL
        LEFT JOIN media.assets profile_photo
          ON profile_photo.id = profile.profile_photo_asset_id
          AND profile_photo.deleted_at IS NULL
        WHERE participant.trip_id = $1::uuid
          AND participant.status = 'ACTIVE'
        ORDER BY
          is_owner DESC,
          participant.joined_at ASC,
          participant.id ASC
      `,
      [tripId],
    );

    return rows;
  }

  async findEligibleConnection({ ownerUserId, targetUserId }) {
    const { rows } = await Database.query(
      `
        SELECT
          target_user.id AS user_id,
          target_profile.username,
          target_profile.display_name
        FROM auth.users target_user
        INNER JOIN users.profiles target_profile
          ON target_profile.user_id = target_user.id
          AND target_profile.deleted_at IS NULL
        INNER JOIN users.connections connection_record
          ON connection_record.user_low_id =
            LEAST($1::uuid, target_user.id)
          AND connection_record.user_high_id =
            GREATEST($1::uuid, target_user.id)
        WHERE target_user.id = $2::uuid
          AND target_user.status = 'ACTIVE'
          AND $1::uuid <> $2::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM users.blocked_users blocked
            WHERE (
              blocked.user_id = $1::uuid
              AND blocked.blocked_user_id = $2::uuid
            ) OR (
              blocked.user_id = $2::uuid
              AND blocked.blocked_user_id = $1::uuid
            )
          )
        LIMIT 1
      `,
      [ownerUserId, targetUserId],
    );

    return rows[0] ?? null;
  }

  async add({ tripId, userId, addedBy }) {
    return Database.transaction(async (client) => {
      const { rows: [trip] } = await client.query(
        'SELECT itinerary_id FROM trip.trips WHERE id=$1::uuid AND user_id=$2::uuid', [tripId, addedBy]);
      if (!trip) { return null; }
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))', [trip.itinerary_id]);
    const { rows } = await client.query(
      `
        INSERT INTO trip.trip_participants (
          trip_id,
          user_id,
          added_by
        ) SELECT $1::uuid, $2::uuid, $3::uuid
        WHERE NOT EXISTS (
          SELECT 1 FROM groups.groups g WHERE g.itinerary_id=$4::uuid
        ) OR EXISTS (
          SELECT 1 FROM groups.groups g
          JOIN groups.group_members m ON m.group_id=g.id AND m.status='ACTIVE'
          WHERE g.itinerary_id=$4::uuid AND g.status='ACTIVE' AND g.deleted_at IS NULL
            AND m.user_id=$2::uuid
        )
        ON CONFLICT (trip_id, user_id)
        DO UPDATE SET
          status = 'ACTIVE',
          added_by = EXCLUDED.added_by,
          joined_at = CURRENT_TIMESTAMP,
          removed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [tripId, userId, addedBy, trip.itinerary_id],
    );

    return rows[0] ?? null;
    });
  }

  async removeOwned({ itineraryId, ownerUserId, targetUserId }) {
    const { rows } = await Database.query(
      `
        UPDATE trip.trip_participants participant
        SET
          status = 'REMOVED',
          removed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        FROM trip.trips trip_record,
          itinerary.itineraries itinerary_record
        WHERE participant.trip_id = trip_record.id
          AND participant.user_id = $3::uuid
          AND participant.status = 'ACTIVE'
          AND trip_record.itinerary_id = itinerary_record.id
          AND trip_record.user_id = $2::uuid
          AND trip_record.user_id <> participant.user_id
          AND itinerary_record.id = $1::uuid
          AND itinerary_record.created_by = $2::uuid
          AND itinerary_record.deleted_at IS NULL
        RETURNING participant.id, participant.user_id,
          participant.status, participant.removed_at
      `,
      [itineraryId, ownerUserId, targetUserId],
    );

    return rows[0] ?? null;
  }
}

export default new ItineraryExpenseParticipantsRepository();
