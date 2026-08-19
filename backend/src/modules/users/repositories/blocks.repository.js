import Database
  from "../../../database/database-manager.js";

class BlocksRepository {
  async blockUser({
    userId,
    blockedUserId,
  }) {
    const sql = `
      WITH reportable_target AS (
        SELECT
          auth_user.id

        FROM auth.users
          AS auth_user

        INNER JOIN users.profiles
          AS profile
          ON profile.user_id =
            auth_user.id
         AND profile.deleted_at
            IS NULL

        WHERE auth_user.id =
            $2::uuid
          AND auth_user.status =
            'ACTIVE'
      ),

      saved_block AS (
        INSERT INTO users.blocked_users
          AS blocked (
            user_id,
            blocked_user_id
          )

        SELECT
          $1::uuid,
          reportable_target.id

        FROM reportable_target

        ON CONFLICT (
          user_id,
          blocked_user_id
        )
        DO UPDATE SET
          reason =
            blocked.reason

        RETURNING
          blocked.id,
          blocked.user_id,
          blocked.blocked_user_id,
          blocked.created_at
      ),

      removed_connection AS (
        DELETE FROM users.connections
          AS connection

        USING saved_block

        WHERE connection.user_low_id =
            LEAST(
              saved_block.user_id,
              saved_block.blocked_user_id
            )
          AND connection.user_high_id =
            GREATEST(
              saved_block.user_id,
              saved_block.blocked_user_id
            )

        RETURNING
          connection.id
      ),

      cancelled_requests AS (
        UPDATE users.connection_requests
          AS request

        SET
          status =
            'CANCELLED',
          updated_at =
            CURRENT_TIMESTAMP,
          resolved_at =
            CURRENT_TIMESTAMP

        FROM saved_block

        WHERE request.status =
            'PENDING'
          AND (
            (
              request.sender_user_id =
                saved_block.user_id
              AND request.receiver_user_id =
                saved_block.blocked_user_id
            )
            OR (
              request.sender_user_id =
                saved_block.blocked_user_id
              AND request.receiver_user_id =
                saved_block.user_id
            )
          )

        RETURNING
          request.id
      )

      SELECT
        saved_block.id,
        saved_block.user_id,
        saved_block.blocked_user_id,
        saved_block.created_at,

        blocked_profile.username
          AS blocked_username,

        blocked_profile.display_name
          AS blocked_display_name,

        blocked_profile.is_verified
          AS blocked_is_verified,

        blocked_profile.is_private
          AS blocked_is_private,

        profile_photo.id
          AS blocked_profile_photo_id,

        profile_photo.storage_provider
          AS blocked_profile_photo_storage_provider,

        profile_photo.bucket
          AS blocked_profile_photo_bucket,

        profile_photo.storage_key
          AS blocked_profile_photo_storage_key,

        profile_photo.mime_type
          AS blocked_profile_photo_mime_type,

        profile_photo.is_public
          AS blocked_profile_photo_is_public,

        EXISTS (
          SELECT 1
          FROM removed_connection
        ) AS connection_removed,

        (
          SELECT COUNT(*)::integer
          FROM cancelled_requests
        ) AS requests_cancelled

      FROM saved_block

      INNER JOIN users.profiles
        AS blocked_profile
        ON blocked_profile.user_id =
          saved_block.blocked_user_id

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          blocked_profile.profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          blockedUserId,
        ],
      );

    return rows[0] ?? null;
  }

  async unblockUser({
    userId,
    blockedUserId,
  }) {
    const sql = `
      DELETE FROM users.blocked_users
        AS blocked

      WHERE blocked.user_id =
          $1::uuid
        AND blocked.blocked_user_id =
          $2::uuid

      RETURNING
        blocked.id,
        blocked.user_id,
        blocked.blocked_user_id,
        blocked.created_at
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          blockedUserId,
        ],
      );

    return rows[0] ?? null;
  }

  async listBlockedUsers({
    userId,
    limit,
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
      userId,
    ];

    let cursorCondition =
      "";

    if (cursor) {
      params.push(
        cursor.createdAt,
        cursor.id,
      );

      cursorCondition = `
        AND (
          blocked.created_at,
          blocked.id
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
        blocked.id,
        blocked.user_id,
        blocked.blocked_user_id,
        blocked.created_at,

        blocked.created_at::text
          AS cursor_created_at,

        blocked_profile.username
          AS blocked_username,

        blocked_profile.display_name
          AS blocked_display_name,

        blocked_profile.is_verified
          AS blocked_is_verified,

        blocked_profile.is_private
          AS blocked_is_private,

        profile_photo.id
          AS blocked_profile_photo_id,

        profile_photo.storage_provider
          AS blocked_profile_photo_storage_provider,

        profile_photo.bucket
          AS blocked_profile_photo_bucket,

        profile_photo.storage_key
          AS blocked_profile_photo_storage_key,

        profile_photo.mime_type
          AS blocked_profile_photo_mime_type,

        profile_photo.is_public
          AS blocked_profile_photo_is_public

      FROM users.blocked_users
        AS blocked

      INNER JOIN auth.users
        AS blocked_user
        ON blocked_user.id =
          blocked.blocked_user_id
       AND blocked_user.status =
          'ACTIVE'

      INNER JOIN users.profiles
        AS blocked_profile
        ON blocked_profile.user_id =
          blocked_user.id
       AND blocked_profile.deleted_at
          IS NULL

      LEFT JOIN media.assets
        AS profile_photo
        ON profile_photo.id =
          blocked_profile.profile_photo_asset_id
       AND profile_photo.deleted_at
          IS NULL

      WHERE blocked.user_id =
          $1::uuid

      ${cursorCondition}

      ORDER BY
        blocked.created_at DESC,
        blocked.id DESC

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

export default new BlocksRepository();
