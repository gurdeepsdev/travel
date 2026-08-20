import Database from "../../../database/database-manager.js";

class CommentLikesRepository {
  /**
   * Returns the comment and post context needed
   * before allowing an interaction.
   */
  async findCommentContext({
    commentId,
    viewerUserId,
  }) {
    const sql = `
      SELECT
        comment.id,
        comment.post_id,
        comment.user_id,

        EXISTS (
          SELECT 1
          FROM users.blocked_users blocked
          WHERE (
            blocked.user_id = $2::uuid
            AND blocked.blocked_user_id =
              comment.user_id
          )
          OR (
            blocked.user_id =
              comment.user_id
            AND blocked.blocked_user_id =
              $2::uuid
          )
        ) AS has_block_relationship

      FROM explore.comments comment

      WHERE comment.id = $1::uuid

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        commentId,
        viewerUserId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
 * Returns comment-like list context only when
 * the viewer owns the post containing the comment.
 */
async findOwnerListContext({
  commentId,
  viewerUserId,
}) {
  const sql = `
    SELECT
      comment.id,
      comment.post_id,
      comment.user_id
        AS comment_author_user_id,

      comment.like_count,

      post.user_id
        AS post_owner_user_id

    FROM explore.comments comment

    INNER JOIN explore.posts post
      ON post.id = comment.post_id
      AND post.deleted_at IS NULL

    WHERE comment.id = $1::uuid
      AND post.user_id = $2::uuid

    LIMIT 1
  `;

  const { rows } = await Database.query(
    sql,
    [
      commentId,
      viewerUserId,
    ],
  );

  return rows[0] ?? null;
}

/**
 * Returns users who liked a comment using stable
 * keyset pagination.
 *
 * The service must call findOwnerListContext()
 * before this method.
 */
async listByComment({
  commentId,
  viewerUserId,
  limit = 20,
  cursor = null,
}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    50,
  );

  const params = [
    commentId,
    viewerUserId,
  ];

  let cursorCondition = "";

  if (cursor) {
    params.push(cursor.createdAt);
    params.push(cursor.id);

    cursorCondition = `
      AND (
        comment_like.created_at,
        comment_like.id
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
      comment_like.id,
      comment_like.comment_id,
      comment_like.user_id,
      comment_like.created_at,

      comment_like.created_at::text
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
        comment_like.user_id =
          $2::uuid
      ) AS viewer_is_self

    FROM explore.comment_likes
      AS comment_like

    INNER JOIN auth.users
      AS like_user
      ON like_user.id =
        comment_like.user_id

    LEFT JOIN users.profiles
      AS profile
      ON profile.user_id =
        comment_like.user_id
      AND profile.deleted_at IS NULL

    LEFT JOIN media.assets
      AS profile_photo
      ON profile_photo.id =
        profile.profile_photo_asset_id
      AND profile_photo.deleted_at IS NULL

    WHERE comment_like.comment_id =
        $1::uuid

      AND (
        comment_like.user_id =
          $2::uuid

        OR NOT EXISTS (
          SELECT 1
          FROM users.blocked_users
            AS blocked

          WHERE (
            blocked.user_id =
              $2::uuid

            AND blocked.blocked_user_id =
              comment_like.user_id
          )
          OR (
            blocked.user_id =
              comment_like.user_id

            AND blocked.blocked_user_id =
              $2::uuid
          )
        )
      )

      ${cursorCondition}

    ORDER BY
      comment_like.created_at DESC,
      comment_like.id DESC

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


  /**
   * Adds a like once per user and comment.
   *
   * ON CONFLICT makes repeated PUT requests
   * idempotent.
   */
  async add({
    commentId,
    userId,
  }) {
    const sql = `
      INSERT INTO explore.comment_likes (
        comment_id,
        user_id
      )
      VALUES (
        $1::uuid,
        $2::uuid
      )

      ON CONFLICT (
        comment_id,
        user_id
      )
      DO NOTHING

      RETURNING
        id,
        comment_id,
        user_id,
        created_at
    `;

    const { rows } = await Database.query(
      sql,
      [
        commentId,
        userId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Removes the authenticated user's like.
   *
   * Returning null when no row exists keeps
   * DELETE idempotent.
   */
  async remove({
    commentId,
    userId,
  }) {
    const sql = `
      DELETE FROM explore.comment_likes
      WHERE comment_id = $1::uuid
        AND user_id = $2::uuid

      RETURNING id
    `;

    const { rows } = await Database.query(
      sql,
      [
        commentId,
        userId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Returns canonical state after a mutation.
   *
   * like_count is maintained by the database
   * trigger, while viewer_has_liked is read from
   * the unique relationship table.
   */
  async getState({
    commentId,
    userId,
  }) {
    const sql = `
      SELECT
        comment.id,
        comment.like_count,

        EXISTS (
          SELECT 1
          FROM explore.comment_likes
            comment_like
          WHERE comment_like.comment_id =
              comment.id
            AND comment_like.user_id =
              $2::uuid
        ) AS viewer_has_liked

      FROM explore.comments comment

      WHERE comment.id = $1::uuid

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        commentId,
        userId,
      ],
    );

    return rows[0] ?? null;
  }
}

export default new CommentLikesRepository();
