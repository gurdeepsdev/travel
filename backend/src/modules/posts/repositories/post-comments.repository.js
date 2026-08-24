import Database from "../../../database/database-manager.js";

class PostCommentsRepository {
  /**
   * Creates a top-level comment or reply.
   *
   * For replies, insertion occurs only when the parent
   * belongs to the same post.
   */
  async create({
    postId,
    userId,
    comment,
    parentCommentId = null,
  }) {
    const sql = `
      WITH inserted_comment AS (
        INSERT INTO explore.comments (
          post_id,
          user_id,
          comment,
          parent_comment_id
        )

        SELECT
          $1::uuid,
          $2::uuid,
          $3::varchar,
          $4::uuid

        WHERE
          $4::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM explore.comments parent
            WHERE parent.id = $4::uuid
              AND parent.post_id = $1::uuid
          )

        RETURNING
          id,
          post_id,
          user_id,
          comment,
          parent_comment_id,
          like_count,
          created_at,
          updated_at
      )

      SELECT
        inserted_comment.id,
        inserted_comment.post_id,
        inserted_comment.user_id,
        inserted_comment.comment,
        inserted_comment.parent_comment_id,
        inserted_comment.like_count,
        inserted_comment.created_at,
        inserted_comment.updated_at,

        profile.username,
        profile.display_name,
        profile.is_verified,

        profile_photo.id
          AS profile_photo_id,
        profile_photo.storage_provider
          AS profile_photo_storage_provider,
        profile_photo.bucket
          AS profile_photo_bucket,
        profile_photo.storage_key
          AS profile_photo_storage_key,
        profile_photo.mime_type
          AS profile_photo_mime_type

      FROM inserted_comment

      LEFT JOIN users.profiles profile
        ON profile.user_id =
          inserted_comment.user_id
        AND profile.deleted_at IS NULL

      LEFT JOIN media.assets profile_photo
        ON profile_photo.id =
          profile.profile_photo_asset_id
        AND profile_photo.deleted_at IS NULL
    `;

    const { rows } = await Database.query(sql, [
      postId,
      userId,
      comment,
      parentCommentId,
    ]);

    return rows[0] ?? null;
  }


  /**
 * Deletes a comment only when the viewer is either:
 * - the comment author, or
 * - the owner of the post.
 *
 * Deleting a parent automatically deletes its
 * replies and attached likes through database
 * cascades.
 */
async deleteAuthorized({
  commentId,
  userId,
}) {
  const sql = `
    DELETE FROM explore.comments
      AS post_comment

    USING explore.posts
      AS post

    WHERE post_comment.id =
        $1::uuid

      AND post.id =
        post_comment.post_id

      AND (
        post_comment.user_id =
          $2::uuid

        OR post.user_id =
          $2::uuid
      )

    RETURNING
      post_comment.id,
      post_comment.post_id,
      post_comment.user_id,
      post_comment.parent_comment_id
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
   * Returns top-level comments for a post using
   * keyset pagination.
   *
   * Replies are represented by reply_count and will
   * be fetched through a separate replies endpoint.
   */
  async listTopLevelByPost({
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
          post_comment.created_at,
          post_comment.id
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
        post_comment.id,
        post_comment.post_id,
        post_comment.user_id,
        post_comment.comment,
        post_comment.parent_comment_id,
        post_comment.like_count,
        post_comment.created_at,
        post_comment.updated_at,

        post_comment.created_at::text
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
          AND post_comment.user_id = $2::uuid
        ) AS viewer_is_author,

        CASE
          WHEN $2::uuid IS NULL
          THEN 'NONE'
          WHEN post_comment.user_id = $2::uuid
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
          AS relationship_request_id,

        (
          SELECT COUNT(*)::bigint
          FROM explore.comments reply
          WHERE reply.parent_comment_id =
            post_comment.id
        ) AS reply_count

      FROM explore.comments post_comment

      INNER JOIN auth.users comment_user
        ON comment_user.id =
          post_comment.user_id

      LEFT JOIN users.profiles profile
        ON profile.user_id =
          post_comment.user_id
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
            LEAST($2::uuid, post_comment.user_id)
          AND connection.user_high_id =
            GREATEST($2::uuid, post_comment.user_id)
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
            post_comment.user_id
          )
          AND GREATEST(
            request.sender_user_id,
            request.receiver_user_id
          ) = GREATEST(
            $2::uuid,
            post_comment.user_id
          )
        ORDER BY
          request.created_at DESC,
          request.id DESC
        LIMIT 1
      ) viewer_request
        ON TRUE

      WHERE post_comment.post_id = $1::uuid
        AND post_comment.parent_comment_id
          IS NULL

        AND (
          $2::uuid IS NULL
          OR post_comment.user_id = $2::uuid
          OR NOT EXISTS (
            SELECT 1
            FROM users.blocked_users blocked
            WHERE (
              blocked.user_id = $2::uuid
              AND blocked.blocked_user_id =
                post_comment.user_id
            )
            OR (
              blocked.user_id =
                post_comment.user_id
              AND blocked.blocked_user_id =
                $2::uuid
            )
          )
        )

        ${cursorCondition}

      ORDER BY
        post_comment.created_at DESC,
        post_comment.id DESC

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
   * Returns the source-of-truth count after mutation.
   */
  async countByPostId(postId) {
    const sql = `
      SELECT COUNT(*)::bigint AS comment_count
      FROM explore.comments
      WHERE post_id = $1
    `;

    const { rows } = await Database.query(sql, [
      postId,
    ]);

    return Number(
      rows[0]?.comment_count ?? 0,
    );
  }
}

export default new PostCommentsRepository();
