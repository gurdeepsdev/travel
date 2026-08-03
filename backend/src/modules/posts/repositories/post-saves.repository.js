import Database from "../../../database/database-manager.js";

class PostSavesRepository {
  /**
   * Saves a post or reactivates a previously
   * inactive saved-item row.
   *
   * Repeated PUT requests remain idempotent.
   */
  async save({
    postId,
    userId,
  }) {
      const sql = `
      WITH target_post AS (
        SELECT post.id
        FROM explore.posts post
        WHERE post.id = $2::uuid
        FOR KEY SHARE
      )

      INSERT INTO users.saved_items
        AS saved_item (
          user_id,
          item_type,
          item_id,
          is_active
        )

      SELECT
        $1::uuid,
        'POST',
        target_post.id,
        TRUE

      FROM target_post

      ON CONFLICT (
        user_id,
        item_type,
        item_id
      )
      DO UPDATE SET
        is_active = TRUE,

        created_at = CASE
          WHEN saved_item.is_active IS TRUE
          THEN saved_item.created_at
          ELSE CURRENT_TIMESTAMP
        END

      RETURNING
        id,
        user_id,
        item_type,
        item_id,
        is_active,
        created_at
    `;

    const { rows } = await Database.query(
      sql,
      [
        userId,
        postId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Soft-removes a saved post.
   *
   * Keeping the row allows a later PUT to reactivate
   * it without violating the existing unique
   * constraint.
   */
  async remove({
    postId,
    userId,
  }) {
    const sql = `
      UPDATE users.saved_items
      SET is_active = FALSE

      WHERE user_id = $1::uuid
        AND item_type = 'POST'
        AND item_id = $2::uuid
        AND is_active IS TRUE

      RETURNING
        id,
        user_id,
        item_type,
        item_id,
        is_active,
        created_at
    `;

    const { rows } = await Database.query(
      sql,
      [
        userId,
        postId,
      ],
    );

    return rows[0] ?? null;
  }

  /**
   * Returns the canonical viewer state after
   * save or unsave operations.
   */
  async getState({
    postId,
    userId,
  }) {
    const sql = `
      SELECT
        id,
        user_id,
        item_type,
        item_id,
        is_active,
        created_at

      FROM users.saved_items

      WHERE user_id = $1::uuid
        AND item_type = 'POST'
        AND item_id = $2::uuid

      LIMIT 1
    `;

    const { rows } = await Database.query(
      sql,
      [
        userId,
        postId,
      ],
    );

    return rows[0] ?? null;
  }
}

export default new PostSavesRepository();