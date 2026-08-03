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