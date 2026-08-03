import Database from "../../../database/database-manager.js";

class PostReactionsRepository {
  /**
   * Finds the minimum post information needed for authorization.
   */


  /**
   * Creates the user's reaction or replaces their existing reaction.
   *
   * The unique constraint on (post_id, user_id) makes this operation
   * safe under retries and concurrent requests.
   */
  async upsertReaction({
    postId,
    userId,
    reactionType,
  }) {
    const sql = `
      INSERT INTO explore.post_likes (
        post_id,
        user_id,
        reaction_type
      )
      VALUES ($1, $2, $3)

      ON CONFLICT (post_id, user_id)
      DO UPDATE SET
        reaction_type = EXCLUDED.reaction_type,
        updated_at = CURRENT_TIMESTAMP

      RETURNING
        id,
        post_id,
        user_id,
        reaction_type,
        created_at,
        updated_at
    `;

    const { rows } = await Database.query(sql, [
      postId,
      userId,
      reactionType,
    ]);

    return rows[0];
  }

  /**
   * Removes only the authenticated user's reaction.
   *
   * Returning null when no row exists makes deletion idempotent.
   */
  async deleteReaction({
    postId,
    userId,
  }) {
    const sql = `
      DELETE FROM explore.post_likes
      WHERE post_id = $1
        AND user_id = $2

      RETURNING
        id,
        post_id,
        user_id,
        reaction_type,
        created_at,
        updated_at
    `;

    const { rows } = await Database.query(sql, [
      postId,
      userId,
    ]);

    return rows[0] ?? null;
  }

  /**
   * Returns the viewer's current reaction for a post.
   */
  async findUserReaction({
    postId,
    userId,
  }) {
    const sql = `
      SELECT
        id,
        post_id,
        user_id,
        reaction_type,
        created_at,
        updated_at
      FROM explore.post_likes
      WHERE post_id = $1
        AND user_id = $2
      LIMIT 1
    `;

    const { rows } = await Database.query(sql, [
      postId,
      userId,
    ]);

    return rows[0] ?? null;
  }

  /**
   * Returns reaction totals grouped by type.
   */
  async getReactionSummary(postId) {
    const sql = `
      SELECT
        reaction_type,
        COUNT(*)::bigint AS reaction_count
      FROM explore.post_likes
      WHERE post_id = $1
      GROUP BY reaction_type
      ORDER BY reaction_type ASC
    `;

    const { rows } = await Database.query(sql, [
      postId,
    ]);

    return rows;
  }

  async listByPost({
  postId,
  viewerUserId = null,
  reactionType = null,
  limit = 20,
  cursor = null,
}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50,
  );

  const params = [
    postId,
    reactionType,
    viewerUserId,
  ];

  let cursorCondition = "";

  if (cursor) {
    params.push(cursor.createdAt);
    params.push(cursor.id);

    cursorCondition = `
      AND (
        post_like.created_at,
        post_like.id
      ) < (
        $4::timestamp,
        $5::uuid
      )
    `;
  }

  params.push(safeLimit + 1);

  const limitParameterIndex =
    params.length;

  const sql = `
    SELECT
      post_like.id,
      post_like.post_id,
      post_like.user_id,
      post_like.reaction_type,
    post_like.created_at,
post_like.updated_at,

post_like.created_at::text
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
        $3::uuid IS NOT NULL
        AND post_like.user_id = $3::uuid
      ) AS viewer_is_self

    FROM explore.post_likes post_like

  INNER JOIN auth.users reaction_user
  ON reaction_user.id =
    post_like.user_id

    LEFT JOIN users.profiles profile
      ON profile.user_id =
        post_like.user_id
      AND profile.deleted_at IS NULL

    LEFT JOIN media.assets profile_photo
      ON profile_photo.id =
        profile.profile_photo_asset_id
      AND profile_photo.deleted_at IS NULL

    WHERE post_like.post_id = $1::uuid

      AND (
        $2::varchar IS NULL
        OR post_like.reaction_type =
          $2::varchar
      )

      AND (
        $3::uuid IS NULL
        OR post_like.user_id = $3::uuid
        OR NOT EXISTS (
          SELECT 1
          FROM users.blocked_users blocked
          WHERE (
            blocked.user_id = $3::uuid
            AND blocked.blocked_user_id =
              post_like.user_id
          )
          OR (
            blocked.user_id =
              post_like.user_id
            AND blocked.blocked_user_id =
              $3::uuid
          )
        )
      )

      ${cursorCondition}

    ORDER BY
      post_like.created_at DESC,
      post_like.id DESC

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




export default new PostReactionsRepository();