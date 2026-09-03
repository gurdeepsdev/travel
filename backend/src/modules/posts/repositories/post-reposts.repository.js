import Database from "../../../database/database-manager.js";

class PostRepostsRepository {
  async resolveOriginalPostId({
    postId,
  }) {
    const { rows } =
      await Database.query(
        `
          SELECT
            COALESCE(
              repost.shared_post_id,
              post.id
            ) AS original_post_id

          FROM explore.posts post

          LEFT JOIN explore.post_reshare repost
            ON repost.post_id = post.id

          WHERE post.id = $1::uuid
            AND post.deleted_at IS NULL

          LIMIT 1
        `,
        [postId],
      );

    return rows[0]?.original_post_id ?? null;
  }

  async set({
    originalPostId,
    userId,
    message,
  }) {
    return Database.transaction(
      async (client) => {
        await client.query(
          `
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                $1::text || ':' || $2::text,
                0
              )
            )
          `,
          [userId, originalPostId],
        );

        const existingResult =
          await client.query(
            `
              SELECT
                repost.id,
                repost.post_id,
                repost.shared_post_id,
                repost.caption,
                repost.created_at

              FROM explore.post_reshare repost

              INNER JOIN explore.posts post
                ON post.id = repost.post_id

              WHERE repost.user_id = $1::uuid
                AND repost.shared_post_id =
                  $2::uuid

              LIMIT 1
            `,
            [userId, originalPostId],
          );

        const existing =
          existingResult.rows[0] ?? null;

        if (existing) {
          await client.query(
            `
              UPDATE explore.posts
              SET
                deleted_at = NULL,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1::uuid
                AND user_id = $2::uuid
            `,
            [existing.post_id, userId],
          );

          await client.query(
            `
              UPDATE explore.post_reshare
              SET caption = $2::varchar
              WHERE id = $1::uuid
            `,
            [existing.id, message ?? null],
          );

          return {
            postId: existing.post_id,
            created: false,
          };
        }

        const postResult =
          await client.query(
            `
              INSERT INTO explore.posts (
                user_id,
                caption,
                post_type,
                visibility,
                place_id,
                city_id
              )

              SELECT
                $2::uuid,
                NULL,
                original.post_type,
                CASE
                  WHEN profile.is_private
                    THEN 'PRIVATE'
                  ELSE 'PUBLIC'
                END,
                original.place_id,
                original.city_id

              FROM explore.posts original

              INNER JOIN users.profiles profile
                ON profile.user_id = $2::uuid
                AND profile.deleted_at IS NULL

              WHERE original.id = $1::uuid
                AND original.deleted_at
                  IS NULL

              RETURNING id
            `,
            [originalPostId, userId],
          );

        const repostPost =
          postResult.rows[0] ?? null;

        if (!repostPost) {
          return null;
        }

        await client.query(
          `
            INSERT INTO explore.post_reshare (
              post_id,
              user_id,
              shared_post_id,
              caption
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::varchar
            )
          `,
          [
            repostPost.id,
            userId,
            originalPostId,
            message ?? null,
          ],
        );

        await client.query(
          `
            UPDATE explore.posts
            SET share_count =
              COALESCE(share_count, 0) + 1
            WHERE id = $1::uuid
          `,
          [originalPostId],
        );

        return {
          postId: repostPost.id,
          created: true,
        };
      },
    );
  }

  async remove({
    originalPostId,
    userId,
  }) {
    return Database.transaction(
      async (client) => {
        await client.query(
          `
            SELECT pg_advisory_xact_lock(
              hashtextextended(
                $1::text || ':' || $2::text,
                0
              )
            )
          `,
          [userId, originalPostId],
        );

        const deletedResult =
          await client.query(
            `
              DELETE FROM explore.post_reshare
              WHERE user_id = $1::uuid
                AND shared_post_id =
                  $2::uuid

              RETURNING
                id,
                post_id,
                shared_post_id
            `,
            [userId, originalPostId],
          );

        const deleted =
          deletedResult.rows[0] ?? null;

        if (!deleted) {
          return null;
        }

        await client.query(
          `
            UPDATE explore.posts
            SET
              deleted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::uuid
              AND user_id = $2::uuid
              AND deleted_at IS NULL
          `,
          [deleted.post_id, userId],
        );

        await client.query(
          `
            UPDATE explore.posts
            SET share_count = GREATEST(
              COALESCE(share_count, 0) - 1,
              0
            )
            WHERE id = $1::uuid
          `,
          [originalPostId],
        );

        return deleted;
      },
    );
  }
}

export default new PostRepostsRepository();
