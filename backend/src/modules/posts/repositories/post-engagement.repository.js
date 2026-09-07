import Database from "../../../database/database-manager.js";

class PostEngagementRepository {
  async getByPostIds({ postIds, viewerUserId }) {
    const sql = `
      SELECT
        post.id AS post_id,
        post.comment_count,
        COALESCE(reactions.total, 0)::bigint AS reaction_count,
        COALESCE(reactions.summary, '{}'::jsonb) AS reaction_summary,
        COALESCE(been_there.total, 0)::bigint AS been_there_count,
        viewer_reaction.reaction_type AS viewer_reaction,
        (viewer_been_there.user_id IS NOT NULL) AS viewer_been_there
      FROM explore.posts post
      LEFT JOIN users.profiles owner_profile
        ON owner_profile.user_id = post.user_id
        AND owner_profile.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS total,
          jsonb_object_agg(grouped.reaction_type, grouped.total) AS summary
        FROM (
          SELECT reaction_type, COUNT(*)::bigint AS total
          FROM explore.post_likes
          WHERE post_id = post.id
          GROUP BY reaction_type
        ) grouped
      ) reactions ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total
        FROM explore.post_been_there
        WHERE post_id = post.id
      ) been_there ON TRUE
      LEFT JOIN explore.post_likes viewer_reaction
        ON viewer_reaction.post_id = post.id
        AND viewer_reaction.user_id = $2::uuid
      LEFT JOIN explore.post_been_there viewer_been_there
        ON viewer_been_there.post_id = post.id
        AND viewer_been_there.user_id = $2::uuid
      WHERE post.id = ANY($1::uuid[])
        AND post.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM users.blocked_users blocked
          WHERE $2::uuid IS NOT NULL
            AND (
              (blocked.user_id = $2::uuid AND blocked.blocked_user_id = post.user_id)
              OR (blocked.user_id = post.user_id AND blocked.blocked_user_id = $2::uuid)
            )
        )
        AND (
          post.user_id = $2::uuid
          OR post.visibility = 'PUBLIC'
          OR EXISTS (
            SELECT 1
            FROM users.connections connection
            WHERE connection.user_low_id = LEAST($2::uuid, post.user_id)
              AND connection.user_high_id = GREATEST($2::uuid, post.user_id)
          )
        )
    `;

    const { rows } = await Database.query(sql, [
      postIds,
      viewerUserId,
    ]);

    return rows;
  }

  async getPublicState(postId, queryable = Database) {
    const sql = `
      SELECT
        post.id AS post_id,
        post.comment_count,
        COALESCE((SELECT COUNT(*) FROM explore.post_likes reaction WHERE reaction.post_id = post.id), 0)::bigint AS reaction_count,
        COALESCE((
          SELECT jsonb_object_agg(grouped.reaction_type, grouped.total)
          FROM (
            SELECT reaction_type, COUNT(*)::bigint AS total
            FROM explore.post_likes
            WHERE post_id = post.id
            GROUP BY reaction_type
          ) grouped
        ), '{}'::jsonb) AS reaction_summary,
        COALESCE((SELECT COUNT(*) FROM explore.post_been_there marker WHERE marker.post_id = post.id), 0)::bigint AS been_there_count
      FROM explore.posts post
      WHERE post.id = $1::uuid
        AND post.deleted_at IS NULL
    `;

    const { rows } = await queryable.query(sql, [postId]);
    return rows[0] ?? null;
  }
}

export default new PostEngagementRepository();
