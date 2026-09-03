import Database from "../../../database/database-manager.js";

class PostsRepository {
  /**
   * Returns the post information required to decide
   * whether a viewer may interact with it.
   */
  async findAccessContext({
    postId,
    viewerUserId,
  }) {
    const sql = `
      SELECT
        post.id,
        post.user_id,
        post.visibility,

        EXISTS (
          SELECT 1
          FROM users.blocked_users blocked
          WHERE (
            blocked.user_id = $2
            AND blocked.blocked_user_id =
              post.user_id
          )
          OR (
            blocked.user_id = post.user_id
            AND blocked.blocked_user_id = $2
          )
        ) AS has_block_relationship,

        EXISTS (
          SELECT 1
          FROM users.connections connection
          WHERE connection.user_low_id =
              LEAST($2::uuid, post.user_id)
            AND connection.user_high_id =
              GREATEST($2::uuid, post.user_id)
        ) AS is_connected

      FROM explore.posts post

     WHERE post.id = $1
  AND post.deleted_at IS NULL
LIMIT 1
    `;

    const { rows } = await Database.query(sql, [
      postId,
      viewerUserId,
    ]);

    return rows[0] ?? null;
  }

  async updateVisibilityOwned({
    postId,
    userId,
    visibility,
  }) {
    return Database.transaction(
      async (client) => {
        const { rows } =
          await client.query(
            `
              UPDATE explore.posts
              SET
                visibility = $3,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1::uuid
                AND user_id = $2::uuid
                AND deleted_at IS NULL
              RETURNING
                id,
                visibility,
                updated_at
            `,
            [postId, userId, visibility],
          );

        const post = rows[0] ?? null;

        if (!post) {
          return null;
        }

        await client.query(
          `
            UPDATE media.assets asset
            SET is_public = EXISTS (
              SELECT 1
              FROM explore.post_assets usage
              INNER JOIN explore.posts used_post
                ON used_post.id = usage.post_id
                AND used_post.deleted_at IS NULL
                AND UPPER(used_post.visibility) =
                  'PUBLIC'
              WHERE usage.asset_id = asset.id
            )
            WHERE asset.id IN (
              SELECT asset_id
              FROM explore.post_assets
              WHERE post_id = $1::uuid
            )
              AND asset.uploaded_by = $2::uuid
              AND asset.deleted_at IS NULL
          `,
          [postId, userId],
        );

        return post;
      },
    );
  }

    async softDeleteOwned({
    postId,
    userId,
  }) {
    const sql = `
      UPDATE explore.posts
      SET
        deleted_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      RETURNING
        id,
        user_id,
        deleted_at
    `;

    const {
      rows,
    } = await Database.query(
      sql,
      [
        postId,
        userId,
      ],
    );

    return rows[0] ?? null;
  }
}

export default new PostsRepository();
