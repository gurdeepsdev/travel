import PostEngagementRepository from "../repositories/post-engagement.repository.js";
import { POST_REACTION_VALUES } from "../post-reactions.constants.js";

class PostEngagementService {
  async getBatch({ postIds, viewerUserId }) {
    const uniquePostIds = [...new Set(postIds)];
    const rows = await PostEngagementRepository.getByPostIds({
      postIds: uniquePostIds,
      viewerUserId,
    });
    const byId = new Map(rows.map((row) => [String(row.post_id), row]));

    return {
      posts: uniquePostIds
        .map((postId) => byId.get(String(postId)))
        .filter(Boolean)
        .map((row) => {
          const reactionSummary = Object.fromEntries(
            POST_REACTION_VALUES.map((type) => [
              type,
              Number(row.reaction_summary?.[type] ?? 0),
            ]),
          );

          return {
            postId: row.post_id,
            engagement: {
              reactions: Number(row.reaction_count ?? 0),
              reactionSummary,
              comments: Number(row.comment_count ?? 0),
              beenThere: Number(row.been_there_count ?? 0),
            },
            viewerState: {
              reactionType: row.viewer_reaction ?? null,
              beenThere: row.viewer_been_there === true,
            },
          };
        }),
    };
  }
}

export default new PostEngagementService();
