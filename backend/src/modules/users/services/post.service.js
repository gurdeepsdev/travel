import { PostsRepository } from "../repositories/index.js";

class PostService {
  async getMyPosts({
    userId,
    limit,
    cursor = null,
  }) {
    const result = await PostsRepository.getMyPosts({
        userId,
        limit,
        cursor,
      });
      
      return {
        posts: result.rows,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      };
  }
}

export default new PostService();