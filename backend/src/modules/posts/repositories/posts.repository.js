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

        COALESCE(
          profile.is_private,
          false
        ) AS owner_profile_is_private,

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
        ) AS has_block_relationship

      FROM explore.posts post

      LEFT JOIN users.profiles profile
        ON profile.user_id = post.user_id
        AND profile.deleted_at IS NULL

      WHERE post.id = $1
      LIMIT 1
    `;

    const { rows } = await Database.query(sql, [
      postId,
      viewerUserId,
    ]);

    return rows[0] ?? null;
  }
}

export default new PostsRepository();