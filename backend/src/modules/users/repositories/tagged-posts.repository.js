import Database from "../../../database/database-manager.js";
import PostsRepository from "./posts.repository.js";

class TaggedPostsRepository {
  async list({ targetUserId, viewerUserId, limit, cursor }) {
    const { rows } = await Database.query(`
      SELECT post.id, post.created_at::text AS cursor_created_at
      FROM explore.posts post
      JOIN users.profiles author ON author.user_id=post.user_id AND author.deleted_at IS NULL
      JOIN users.profiles target ON target.user_id=$1::uuid AND target.deleted_at IS NULL
      WHERE post.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM explore.post_tagged_users tag
          WHERE tag.post_id=post.id AND tag.tagged_user_id=$1::uuid
        )
        AND (target.is_private IS NOT TRUE OR target.user_id=$2::uuid OR EXISTS (
          SELECT 1 FROM users.connections c
          WHERE $2::uuid IS NOT NULL
            AND c.user_low_id=LEAST($2::uuid,target.user_id)
            AND c.user_high_id=GREATEST($2::uuid,target.user_id)
        ))
        AND (post.user_id=$2::uuid OR UPPER(post.visibility)='PUBLIC' OR (
          UPPER(post.visibility)='PRIVATE' AND EXISTS (
            SELECT 1 FROM users.connections c
            WHERE $2::uuid IS NOT NULL
              AND c.user_low_id=LEAST($2::uuid,post.user_id)
              AND c.user_high_id=GREATEST($2::uuid,post.user_id)
          )
        ))
        AND NOT EXISTS (
          SELECT 1 FROM users.blocked_users b
          WHERE (b.user_id=$2::uuid AND b.blocked_user_id IN (post.user_id,target.user_id))
             OR (b.blocked_user_id=$2::uuid AND b.user_id IN (post.user_id,target.user_id))
        )
        AND ($3::timestamp IS NULL OR (post.created_at,post.id)<($3::timestamp,$4::uuid))
      ORDER BY post.created_at DESC,post.id DESC LIMIT $5
    `, [targetUserId, viewerUserId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1]);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const posts = page.length ? await PostsRepository.getPostsByIds({
      postIds: page.map(row => row.id), viewerUserId,
    }) : [];
    return { posts, hasMore, nextCursor: hasMore && last
      ? { createdAt: last.cursor_created_at, id: last.id } : null };
  }
}

export default new TaggedPostsRepository();
