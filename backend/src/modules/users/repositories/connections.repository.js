import Database
  from "../../../database/database-manager.js";

class ConnectionsRepository {
  /**
   * Creates or returns an outgoing pending request.
   *
   * The pair-level advisory lock serializes concurrent
   * operations for the same two users.
   *
   * The query also reports:
   * - whether the target is active and available;
   * - whether the users are already connected;
   * - whether a reverse pending request exists;
   * - whether this call created a new request.
   */
  async sendRequest({
    senderUserId,
    receiverUserId,
  }) {
    const sql = `
      WITH pair_lock AS MATERIALIZED (
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              LEAST(
                $1::uuid,
                $2::uuid
              )::text
              || ':'
              || GREATEST(
                $1::uuid,
                $2::uuid
              )::text,
              0
            )
          )
      ),

      eligible_target AS MATERIALIZED (
        SELECT
          target_user.id,
          target_profile.username,
          target_profile.display_name,
          target_profile.is_verified,
          target_profile.is_private,

          profile_photo.id
            AS profile_photo_id,

          profile_photo.storage_provider
            AS profile_photo_storage_provider,

          profile_photo.bucket
            AS profile_photo_bucket,

          profile_photo.storage_key
            AS profile_photo_storage_key,

          profile_photo.mime_type
            AS profile_photo_mime_type,

          profile_photo.is_public
            AS profile_photo_is_public

        FROM pair_lock

        INNER JOIN auth.users target_user
          ON target_user.id =
            $2::uuid
          AND target_user.status =
            'ACTIVE'

        INNER JOIN users.profiles
          AS target_profile
          ON target_profile.user_id =
            target_user.id
          AND target_profile.deleted_at
            IS NULL

        LEFT JOIN media.assets
          AS profile_photo
          ON profile_photo.id =
            target_profile
              .profile_photo_asset_id
          AND profile_photo.deleted_at
            IS NULL

        WHERE $1::uuid <>
            $2::uuid

          AND NOT EXISTS (
            SELECT 1

            FROM users.blocked_users
              AS blocked

            WHERE (
              blocked.user_id =
                $1::uuid

              AND blocked.blocked_user_id =
                $2::uuid
            )
            OR (
              blocked.user_id =
                $2::uuid

              AND blocked.blocked_user_id =
                $1::uuid
            )
          )

        FOR KEY SHARE OF
          target_user,
          target_profile
      ),

      existing_connection AS MATERIALIZED (
        SELECT
          connection.id

        FROM users.connections
          AS connection

        CROSS JOIN pair_lock

        WHERE connection.user_low_id =
            LEAST(
              $1::uuid,
              $2::uuid
            )

          AND connection.user_high_id =
            GREATEST(
              $1::uuid,
              $2::uuid
            )

        LIMIT 1
      ),

      incoming_request AS MATERIALIZED (
        SELECT
          request.id

        FROM users.connection_requests
          AS request

        CROSS JOIN pair_lock

        WHERE request.sender_user_id =
            $2::uuid

          AND request.receiver_user_id =
            $1::uuid

          AND request.status =
            'PENDING'

        LIMIT 1
      ),

      outgoing_request AS MATERIALIZED (
        SELECT
          request.id,
          request.sender_user_id,

            request.receiver_user_id,
          request.status,
          request.created_at,
          request.updated_at,
          request.resolved_at

        FROM users.connection_requests
          AS request

        CROSS JOIN pair_lock

        WHERE request.sender_user_id =
            $1::uuid

          AND request.receiver_user_id =
            $2::uuid

          AND request.status =
            'PENDING'

        LIMIT 1
      ),

      inserted_request AS (
        INSERT INTO users.connection_requests (
          sender_user_id,
          receiver_user_id
        )

        SELECT
          $1::uuid,
          eligible_target.id

        FROM eligible_target

        WHERE NOT EXISTS (
            SELECT 1
            FROM existing_connection
          )

          AND NOT EXISTS (
            SELECT 1
            FROM incoming_request
          )

          AND NOT EXISTS (
            SELECT 1
            FROM outgoing_request
          )

        RETURNING
          id,
          sender_user_id,
          receiver_user_id,
          status,
          created_at,
          updated_at,
          resolved_at
      ),

      pending_request AS (
        SELECT
          inserted_request.id,
          inserted_request.sender_user_id,
          inserted_request.receiver_user_id,
          inserted_request.status,
          inserted_request.created_at,
          inserted_request.updated_at,
          inserted_request.resolved_at,
          TRUE AS request_created

        FROM inserted_request

        UNION ALL

        SELECT
          outgoing_request.id,
          outgoing_request.sender_user_id,
          outgoing_request.receiver_user_id,
          outgoing_request.status,
          outgoing_request.created_at,
          outgoing_request.updated_at,
          outgoing_request.resolved_at,
          FALSE AS request_created

        FROM outgoing_request

        LIMIT 1
      )

      SELECT
        (
          eligible_target.id
          IS NOT NULL
        ) AS target_available,

        EXISTS (
          SELECT 1
          FROM existing_connection
        ) AS already_connected,

        (
          SELECT incoming_request.id
          FROM incoming_request
        ) AS incoming_request_id,

        pending_request.id,
        pending_request.sender_user_id,
        pending_request.receiver_user_id,
        pending_request.status,
        pending_request.created_at,
        pending_request.updated_at,
        pending_request.resolved_at,
        pending_request.request_created,

        eligible_target.id
          AS target_user_id,

        eligible_target.username
          AS target_username,

        eligible_target.display_name
          AS target_display_name,

        eligible_target.is_verified
          AS target_is_verified,

        eligible_target.is_private
          AS target_is_private,

        eligible_target.profile_photo_id
          AS target_profile_photo_id,

        eligible_target
          .profile_photo_storage_provider
          AS target_profile_photo_storage_provider,

        eligible_target
          .profile_photo_bucket
          AS target_profile_photo_bucket,

        eligible_target
          .profile_photo_storage_key
          AS target_profile_photo_storage_key,

        eligible_target
          .profile_photo_mime_type
          AS target_profile_photo_mime_type,

        eligible_target
          .profile_photo_is_public
          AS target_profile_photo_is_public

      FROM pair_lock

      LEFT JOIN eligible_target
        ON TRUE

      LEFT JOIN pending_request
        ON TRUE
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          senderUserId,
          receiverUserId,
        ],
      );

    return rows[0] ?? null;
  }


    /**
   * Lists pending requests received by the
   * authenticated user using stable keyset
   * pagination.
   */
  async listIncoming({
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
        cursor.createdAt,
      );

      params.push(
        cursor.id,
      );

      cursorWhere = `
        AND (
          request.created_at,
          request.id
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
        request.id,
request.sender_user_id
  AS request_sender_user_id,
          request.receiver_user_id,
        request.status,
        request.created_at,
        request.updated_at,
        request.resolved_at,

        request.created_at::text
          AS cursor_created_at,

        sender_user.id
          AS sender_user_id,

        sender_profile.username
          AS sender_username,

        sender_profile.display_name
          AS sender_display_name,

        sender_profile.is_verified
          AS sender_is_verified,

        sender_profile.is_private
          AS sender_is_private,

        profile_photo.id
          AS sender_profile_photo_id,

        profile_photo.storage_provider
          AS sender_profile_photo_storage_provider,

        profile_photo.bucket
          AS sender_profile_photo_bucket,

        profile_photo.storage_key
          AS sender_profile_photo_storage_key,

        profile_photo.mime_type
          AS sender_profile_photo_mime_type,

        profile_photo.is_public
          AS sender_profile_photo_is_public

      FROM users.connection_requests
        AS request

      INNER JOIN auth.users
        AS sender_user
        ON sender_user.id =
          request.sender_user_id
       AND sender_user.status =
          'ACTIVE'

      INNER JOIN users.profiles
        AS sender_profile
        ON sender_profile.user_id =
          sender_user.id
       AND sender_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          sender_profile
            .profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL

      WHERE request.receiver_user_id =
          $1::uuid

        AND request.status =
          'PENDING'

        AND NOT EXISTS (
          SELECT 1

          FROM users.blocked_users
            AS blocked

          WHERE (
            blocked.user_id =
              request.sender_user_id

            AND blocked.blocked_user_id =
              request.receiver_user_id
          )
          OR (
            blocked.user_id =
              request.receiver_user_id

            AND blocked.blocked_user_id =
              request.sender_user_id
          )
        )

        ${cursorWhere}

      ORDER BY
        request.created_at DESC,
        request.id DESC

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

    /**
   * Lists pending requests sent by the
   * authenticated user using stable keyset
   * pagination.
   */
  async listOutgoing({
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
        cursor.createdAt,
      );

      params.push(
        cursor.id,
      );

      cursorWhere = `
        AND (
          request.created_at,
          request.id
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
        request.id,
        request.sender_user_id,

        request.receiver_user_id
          AS request_receiver_user_id,

        request.status,
        request.created_at,
        request.updated_at,
        request.resolved_at,

        request.created_at::text
          AS cursor_created_at,

        recipient_user.id
          AS recipient_user_id,

        recipient_profile.username
          AS recipient_username,

        recipient_profile.display_name
          AS recipient_display_name,

        recipient_profile.is_verified
          AS recipient_is_verified,

        recipient_profile.is_private
          AS recipient_is_private,

        profile_photo.id
          AS recipient_profile_photo_id,

        profile_photo.storage_provider
          AS recipient_profile_photo_storage_provider,

        profile_photo.bucket
          AS recipient_profile_photo_bucket,

        profile_photo.storage_key
          AS recipient_profile_photo_storage_key,

        profile_photo.mime_type
          AS recipient_profile_photo_mime_type,

        profile_photo.is_public
          AS recipient_profile_photo_is_public

      FROM users.connection_requests
        AS request

      INNER JOIN auth.users
        AS recipient_user
        ON recipient_user.id =
          request.receiver_user_id
       AND recipient_user.status =
          'ACTIVE'

      INNER JOIN users.profiles
        AS recipient_profile
        ON recipient_profile.user_id =
          recipient_user.id
       AND recipient_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          recipient_profile
            .profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL

      WHERE request.sender_user_id =
          $1::uuid

        AND request.status =
          'PENDING'

        AND NOT EXISTS (
          SELECT 1

          FROM users.blocked_users
            AS blocked

          WHERE (
            blocked.user_id =
              request.sender_user_id

            AND blocked.blocked_user_id =
              request.receiver_user_id
          )
          OR (
            blocked.user_id =
              request.receiver_user_id

            AND blocked.blocked_user_id =
              request.sender_user_id
          )
        )

        ${cursorWhere}

      ORDER BY
        request.created_at DESC,
        request.id DESC

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


    /**
   * Removes an accepted symmetric connection.
   *
   * Either connected user may remove the canonical
   * low/high pair.
   */
  async removeConnection({
    userId,
    connectedUserId,
  }) {
    const sql = `
      WITH pair_lock AS MATERIALIZED (
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              LEAST(
                $1::uuid,
                $2::uuid
              )::text
              || ':'
              || GREATEST(
                $1::uuid,
                $2::uuid
              )::text,
              0
            )
          )
      ),

      deleted_connection AS (
        DELETE FROM users.connections
          AS connection

        USING pair_lock

        WHERE connection.user_low_id =
            LEAST(
              $1::uuid,
              $2::uuid
            )

          AND connection.user_high_id =
            GREATEST(
              $1::uuid,
              $2::uuid
            )

        RETURNING
          connection.id,
          connection.user_low_id,
          connection.user_high_id,
          connection.connected_at
      )

      SELECT
        deleted_connection.id,
        deleted_connection.user_low_id,
        deleted_connection.user_high_id,
        deleted_connection.connected_at

      FROM deleted_connection
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          connectedUserId,
        ],
      );

    return rows[0] ?? null;
  }


  /**
   * Returns the current relationship state between
   * two users.
   *
   * Historical request status is intentionally not
   * used to determine current connection access.
   */
  async getRelationshipContext({
    userId,
    otherUserId,
  }) {
    const sql = `
      SELECT
        EXISTS (
          SELECT 1

          FROM users.connections
            AS connection

          WHERE connection.user_low_id =
              LEAST(
                $1::uuid,
                $2::uuid
              )

            AND connection.user_high_id =
              GREATEST(
                $1::uuid,
                $2::uuid
              )
        ) AS is_connected,

        EXISTS (
          SELECT 1

          FROM users.blocked_users
            AS blocked

          WHERE (
            blocked.user_id =
              $1::uuid

            AND blocked.blocked_user_id =
              $2::uuid
          )
          OR (
            blocked.user_id =
              $2::uuid

            AND blocked.blocked_user_id =
              $1::uuid
          )
        ) AS is_blocked
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          otherUserId,
        ],
      );

    return rows[0] ?? {
      is_connected:
        false,

      is_blocked:
        false,
    };
  }

    /**
   * Lists accepted connections for the
   * authenticated user using stable keyset
   * pagination.
   */
  async listConnections({
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
        cursor.createdAt,
      );

      params.push(
        cursor.id,
      );

      cursorWhere = `
        AND (
          connection.connected_at,
          connection.id
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
        connection.id,
        connection.user_low_id,
        connection.user_high_id,
        connection.connected_at,

        connection.connected_at::text
          AS cursor_connected_at,

        connection_user.id
          AS connection_user_id,

        connection_profile.username
          AS connection_username,

        connection_profile.display_name
          AS connection_display_name,

        connection_profile.is_verified
          AS connection_is_verified,

        connection_profile.is_private
          AS connection_is_private,

        profile_photo.id
          AS connection_profile_photo_id,

        profile_photo.storage_provider
          AS connection_profile_photo_storage_provider,

        profile_photo.bucket
          AS connection_profile_photo_bucket,

        profile_photo.storage_key
          AS connection_profile_photo_storage_key,

        profile_photo.mime_type
          AS connection_profile_photo_mime_type,

        profile_photo.is_public
          AS connection_profile_photo_is_public

      FROM users.connections
        AS connection

      INNER JOIN auth.users
        AS connection_user
        ON connection_user.id =
          CASE
            WHEN connection.user_low_id =
              $1::uuid
            THEN connection.user_high_id
            ELSE connection.user_low_id
          END

       AND connection_user.status =
          'ACTIVE'

      INNER JOIN users.profiles
        AS connection_profile
        ON connection_profile.user_id =
          connection_user.id
       AND connection_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          connection_profile
            .profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL

      WHERE (
        connection.user_low_id =
          $1::uuid

        OR connection.user_high_id =
          $1::uuid
      )

        AND NOT EXISTS (
          SELECT 1

          FROM users.blocked_users
            AS blocked

          WHERE (
            blocked.user_id =
              $1::uuid

            AND blocked.blocked_user_id =
              connection_user.id
          )
          OR (
            blocked.user_id =
              connection_user.id

            AND blocked.blocked_user_id =
              $1::uuid
          )
        )

        ${cursorWhere}

      ORDER BY
        connection.connected_at DESC,
        connection.id DESC

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


    /**
   * Accepts or rejects a pending request.
   *
   * Only the stored receiver may respond.
   *
   * ACCEPT atomically:
   * - marks the request ACCEPTED;
   * - creates the canonical connection.
   *
   * REJECT marks the request REJECTED without
   * creating a connection.
   *
   * Repeating the same action is idempotent.
   * A previously removed connection is never
   * recreated by replaying an old ACCEPT action.
   */
  async respondToRequest({
    requestId,
    receiverUserId,
    action,
  }) {
    const sql = `
      WITH desired_status AS (
        SELECT
          CASE
            WHEN $3::varchar =
              'ACCEPT'
            THEN 'ACCEPTED'
            ELSE 'REJECTED'
          END::varchar
            AS status
      ),

      locked_request AS MATERIALIZED (
        SELECT
          request.id,
          request.sender_user_id,
          request.receiver_user_id,
          request.status,
          request.created_at,
          request.updated_at,
          request.resolved_at

        FROM users.connection_requests
          AS request

        WHERE request.id =
            $1::uuid

          AND request.receiver_user_id =
            $2::uuid

        FOR UPDATE
      ),

      pair_lock AS MATERIALIZED (
        SELECT
          pg_advisory_xact_lock(
            hashtextextended(
              LEAST(
                locked_request
                  .sender_user_id,
                locked_request
                  .receiver_user_id
              )::text
              || ':'
              || GREATEST(
                locked_request
                  .sender_user_id,
                locked_request
                  .receiver_user_id
              )::text,
              0
            )
          )

        FROM locked_request
      ),

      eligible_request AS MATERIALIZED (
        SELECT
          locked_request.*,
          desired_status.status
            AS desired_status

        FROM locked_request

        CROSS JOIN pair_lock
        CROSS JOIN desired_status

        WHERE locked_request.status IN (
          'PENDING',
          desired_status.status
        )

          AND NOT EXISTS (
            SELECT 1

            FROM users.blocked_users
              AS blocked

            WHERE (
              blocked.user_id =
                locked_request
                  .sender_user_id

              AND blocked.blocked_user_id =
                locked_request
                  .receiver_user_id
            )
            OR (
              blocked.user_id =
                locked_request
                  .receiver_user_id

              AND blocked.blocked_user_id =
                locked_request
                  .sender_user_id
            )
          )

          AND (
            $3::varchar =
              'REJECT'

            OR EXISTS (
              SELECT 1

              FROM auth.users
                AS sender_user

              INNER JOIN users.profiles
                AS sender_profile
                ON sender_profile.user_id =
                  sender_user.id
               AND sender_profile.deleted_at
                  IS NULL

              WHERE sender_user.id =
                  locked_request
                    .sender_user_id

                AND sender_user.status =
                  'ACTIVE'
            )
          )
      ),

      updated_request AS (
        UPDATE users.connection_requests
          AS request

        SET
          status =
            eligible_request
              .desired_status,

          resolved_at =
            CURRENT_TIMESTAMP

        FROM eligible_request

        WHERE request.id =
            eligible_request.id

          AND request.status =
            'PENDING'

        RETURNING
          request.id,
          request.sender_user_id,
          request.receiver_user_id,
          request.status,
          request.created_at,
          request.updated_at,
          request.resolved_at
      ),

      final_request AS (
        SELECT
          updated_request.id,
          updated_request.sender_user_id,
          updated_request.receiver_user_id,
          updated_request.status,
          updated_request.created_at,
          updated_request.updated_at,
          updated_request.resolved_at,
          TRUE AS action_applied

        FROM updated_request

        UNION ALL

        SELECT
          eligible_request.id,
          eligible_request.sender_user_id,
          eligible_request.receiver_user_id,
          eligible_request.status,
          eligible_request.created_at,
          eligible_request.updated_at,
          eligible_request.resolved_at,
          FALSE AS action_applied

        FROM eligible_request

        WHERE eligible_request.status =
            eligible_request
              .desired_status

          AND NOT EXISTS (
            SELECT 1
            FROM updated_request
          )

        LIMIT 1
      ),

      inserted_connection AS (
        INSERT INTO users.connections (
          user_low_id,
          user_high_id
        )

        SELECT
          LEAST(
            updated_request
              .sender_user_id,
            updated_request
              .receiver_user_id
          ),

          GREATEST(
            updated_request
              .sender_user_id,
            updated_request
              .receiver_user_id
          )

        FROM updated_request

        WHERE $3::varchar =
            'ACCEPT'

        ON CONFLICT (
          user_low_id,
          user_high_id
        )
        DO NOTHING

        RETURNING
          id,
          user_low_id,
          user_high_id,
          connected_at
      ),

      connection_result AS (
        SELECT
          inserted_connection.id,
          inserted_connection.user_low_id,
          inserted_connection.user_high_id,
          inserted_connection.connected_at

        FROM inserted_connection

        UNION ALL

        SELECT
          connection.id,
          connection.user_low_id,
          connection.user_high_id,
          connection.connected_at

        FROM users.connections
          AS connection

        INNER JOIN final_request
          ON connection.user_low_id =
            LEAST(
              final_request
                .sender_user_id,
              final_request
                .receiver_user_id
            )

         AND connection.user_high_id =
            GREATEST(
              final_request
                .sender_user_id,
              final_request
                .receiver_user_id
            )

        WHERE $3::varchar =
            'ACCEPT'

          AND NOT EXISTS (
            SELECT 1
            FROM inserted_connection
          )

        LIMIT 1
      )

      SELECT
        final_request.id,
        final_request.sender_user_id,
        final_request.receiver_user_id,
        final_request.status,
        final_request.created_at,
        final_request.updated_at,
        final_request.resolved_at,
        final_request.action_applied,

        connection_result.id
          AS connection_id,

        connection_result.user_low_id,
        connection_result.user_high_id,
        connection_result.connected_at,

        sender_user.id
          AS sender_user_id,

        sender_profile.username
          AS sender_username,

        sender_profile.display_name
          AS sender_display_name,

        sender_profile.is_verified
          AS sender_is_verified,

        sender_profile.is_private
          AS sender_is_private,

        profile_photo.id
          AS sender_profile_photo_id,

        profile_photo.storage_provider
          AS sender_profile_photo_storage_provider,

        profile_photo.bucket
          AS sender_profile_photo_bucket,

        profile_photo.storage_key
          AS sender_profile_photo_storage_key,

        profile_photo.mime_type
          AS sender_profile_photo_mime_type,

        profile_photo.is_public
          AS sender_profile_photo_is_public

      FROM final_request

      LEFT JOIN connection_result
        ON TRUE

      LEFT JOIN auth.users
        AS sender_user
        ON sender_user.id =
          final_request.sender_user_id

      LEFT JOIN users.profiles
        AS sender_profile
        ON sender_profile.user_id =
          sender_user.id
       AND sender_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          sender_profile
            .profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL

      WHERE
        $3::varchar =
          'REJECT'

        OR connection_result.id
          IS NOT NULL
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          requestId,
          receiverUserId,
          action,
        ],
      );

    return rows[0] ?? null;
  }


    /**
   * Cancels a pending outgoing connection request.
   *
   * Only the stored sender may cancel it.
   * Repeating cancellation is idempotent.
   */
  async cancelRequest({
    requestId,
    senderUserId,
  }) {
    const sql = `
      WITH locked_request AS MATERIALIZED (
        SELECT
          request.id,
          request.sender_user_id,
          request.receiver_user_id,
          request.status,
          request.created_at,
          request.updated_at,
          request.resolved_at

        FROM users.connection_requests
          AS request

        WHERE request.id =
            $1::uuid

          AND request.sender_user_id =
            $2::uuid

        FOR UPDATE
      ),

      eligible_request AS MATERIALIZED (
        SELECT
          locked_request.*

        FROM locked_request

        WHERE locked_request.status IN (
          'PENDING',
          'CANCELLED'
        )
      ),

      updated_request AS (
        UPDATE users.connection_requests
          AS request

        SET
          status =
            'CANCELLED',

          resolved_at =
            CURRENT_TIMESTAMP

        FROM eligible_request

        WHERE request.id =
            eligible_request.id

          AND request.status =
            'PENDING'

        RETURNING
          request.id,
          request.sender_user_id,
          request.receiver_user_id,
          request.status,
          request.created_at,
          request.updated_at,
          request.resolved_at
      ),

      final_request AS (
        SELECT
          updated_request.id,
          updated_request.sender_user_id,
          updated_request.receiver_user_id,
          updated_request.status,
          updated_request.created_at,
          updated_request.updated_at,
          updated_request.resolved_at,
          TRUE AS action_applied

        FROM updated_request

        UNION ALL

        SELECT
          eligible_request.id,
          eligible_request.sender_user_id,
          eligible_request.receiver_user_id,
          eligible_request.status,
          eligible_request.created_at,
          eligible_request.updated_at,
          eligible_request.resolved_at,
          FALSE AS action_applied

        FROM eligible_request

        WHERE eligible_request.status =
            'CANCELLED'

          AND NOT EXISTS (
            SELECT 1
            FROM updated_request
          )

        LIMIT 1
      )

      SELECT
        final_request.id,
        final_request.sender_user_id,
        final_request.receiver_user_id,
        final_request.status,
        final_request.created_at,
        final_request.updated_at,
        final_request.resolved_at,
        final_request.action_applied,

        recipient_user.id
          AS recipient_user_id,

        recipient_profile.username
          AS recipient_username,

        recipient_profile.display_name
          AS recipient_display_name,

        recipient_profile.is_verified
          AS recipient_is_verified,

        recipient_profile.is_private
          AS recipient_is_private,

        profile_photo.id
          AS recipient_profile_photo_id,

        profile_photo.storage_provider
          AS recipient_profile_photo_storage_provider,

        profile_photo.bucket
          AS recipient_profile_photo_bucket,

        profile_photo.storage_key
          AS recipient_profile_photo_storage_key,

        profile_photo.mime_type
          AS recipient_profile_photo_mime_type,

        profile_photo.is_public
          AS recipient_profile_photo_is_public

      FROM final_request

      LEFT JOIN auth.users
        AS recipient_user
        ON recipient_user.id =
          final_request.receiver_user_id

      LEFT JOIN users.profiles
        AS recipient_profile
        ON recipient_profile.user_id =
          recipient_user.id
       AND recipient_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          recipient_profile
            .profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          requestId,
          senderUserId,
        ],
      );

    return rows[0] ?? null;
  }


}

export default new ConnectionsRepository();