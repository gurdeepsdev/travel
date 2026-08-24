import Database from "../../../database/database-manager.js";

class PostBeenThereRepository {
  /**
   * Adds the user's Been There state.
   *
   * The database unique constraint makes repeated and
   * concurrent requests safe.
   */
  async add({
    postId,
    userId,
  }) {
    const sql = `
      INSERT INTO explore.post_been_there (
        post_id,
        user_id
      )
      VALUES ($1, $2)

      ON CONFLICT (post_id, user_id)
      DO NOTHING

      RETURNING
        id,
        post_id,
        user_id,
        created_at
    `;

    const result = await Database.query(sql, [
      postId,
      userId,
    ]);

    return {
      created: result.rowCount === 1,
      row: result.rows[0] ?? null,
    };
  }

  /**
   * Removes only the authenticated user's state.
   */
  async remove({
    postId,
    userId,
  }) {
    const sql = `
      DELETE FROM explore.post_been_there
      WHERE post_id = $1
        AND user_id = $2

      RETURNING
        id,
        post_id,
        user_id,
        created_at
    `;

    const result = await Database.query(sql, [
      postId,
      userId,
    ]);

    return {
      removed: result.rowCount === 1,
      row: result.rows[0] ?? null,
    };
  }

  /**
   * Returns whether the user has marked the post
   * as Been There.
   */
  async exists({
    postId,
    userId,
  }) {
    const sql = `
      SELECT EXISTS (
        SELECT 1
        FROM explore.post_been_there
        WHERE post_id = $1
          AND user_id = $2
      ) AS has_been_there
    `;

    const { rows } = await Database.query(sql, [
      postId,
      userId,
    ]);

    return rows[0]?.has_been_there === true;
  }

  /**
   * Returns the total Been There count for a post.
   */
  async countByPostId(postId) {
    const sql = `
      SELECT COUNT(*)::bigint AS been_there_count
      FROM explore.post_been_there
      WHERE post_id = $1
    `;

    const { rows } = await Database.query(sql, [
      postId,
    ]);

    return Number(
      rows[0]?.been_there_count ?? 0,
    );
  }

  async listByPost({
  postId,
  viewerUserId = null,
  limit = 20,
  cursor = null,
}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50,
  );

  const params = [
    postId,
    viewerUserId,
  ];

  let cursorCondition = "";

  if (cursor) {
    params.push(cursor.createdAt);
    params.push(cursor.id);

    cursorCondition = `
      AND (
        been_there.created_at,
        been_there.id
      ) < (
        $3::timestamp,
        $4::uuid
      )
    `;
  }

  params.push(safeLimit + 1);

  const limitParameterIndex =
    params.length;

  const sql = `
    SELECT
      been_there.id,
      been_there.post_id,
      been_there.user_id,
      been_there.created_at,

      been_there.created_at::text
        AS cursor_created_at,

      profile.username,
      profile.display_name,
      profile.is_verified,
      profile.is_private,

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

      (
        $2::uuid IS NOT NULL
        AND been_there.user_id =
          $2::uuid
      ) AS viewer_is_self,

      CASE
        WHEN $2::uuid IS NULL
        THEN 'NONE'
        WHEN been_there.user_id = $2::uuid
        THEN 'SELF'
        WHEN viewer_connection.id IS NOT NULL
        THEN 'CONNECTED'
        WHEN viewer_request.sender_user_id =
          $2::uuid
        THEN 'OUTGOING_PENDING'
        WHEN viewer_request.receiver_user_id =
          $2::uuid
        THEN 'INCOMING_PENDING'
        ELSE 'NONE'
      END AS relationship_status,

      viewer_connection.id
        AS relationship_connection_id,

      viewer_request.id
        AS relationship_request_id

    FROM explore.post_been_there
      AS been_there

    INNER JOIN auth.users visited_user
      ON visited_user.id =
        been_there.user_id

    LEFT JOIN users.profiles profile
      ON profile.user_id =
        been_there.user_id
      AND profile.deleted_at IS NULL

    LEFT JOIN media.assets profile_photo
      ON profile_photo.id =
        profile.profile_photo_asset_id
      AND profile_photo.deleted_at IS NULL

    LEFT JOIN LATERAL (
      SELECT connection.id
      FROM users.connections connection
      WHERE $2::uuid IS NOT NULL
        AND connection.user_low_id =
          LEAST($2::uuid, been_there.user_id)
        AND connection.user_high_id =
          GREATEST($2::uuid, been_there.user_id)
      LIMIT 1
    ) viewer_connection
      ON TRUE

    LEFT JOIN LATERAL (
      SELECT
        request.id,
        request.sender_user_id,
        request.receiver_user_id
      FROM users.connection_requests request
      WHERE $2::uuid IS NOT NULL
        AND request.status = 'PENDING'
        AND LEAST(
          request.sender_user_id,
          request.receiver_user_id
        ) = LEAST(
          $2::uuid,
          been_there.user_id
        )
        AND GREATEST(
          request.sender_user_id,
          request.receiver_user_id
        ) = GREATEST(
          $2::uuid,
          been_there.user_id
        )
      ORDER BY
        request.created_at DESC,
        request.id DESC
      LIMIT 1
    ) viewer_request
      ON TRUE

    WHERE been_there.post_id = $1::uuid

      AND (
        $2::uuid IS NULL
        OR been_there.user_id = $2::uuid
        OR NOT EXISTS (
          SELECT 1
          FROM users.blocked_users blocked
          WHERE (
            blocked.user_id = $2::uuid
            AND blocked.blocked_user_id =
              been_there.user_id
          )
          OR (
            blocked.user_id =
              been_there.user_id
            AND blocked.blocked_user_id =
              $2::uuid
          )
        )
      )

      ${cursorCondition}

    ORDER BY
      been_there.created_at DESC,
      been_there.id DESC

    LIMIT $${limitParameterIndex}
  `;

  const { rows } = await Database.query(
    sql,
    params,
  );

  const hasMore =
    rows.length > safeLimit;

  const paginatedRows = hasMore
    ? rows.slice(0, safeLimit)
    : rows;

  const lastRow =
    paginatedRows.at(-1) ?? null;

  return {
    rows: paginatedRows,
    hasMore,
    lastRow,
  };
}
}

export default new PostBeenThereRepository();
