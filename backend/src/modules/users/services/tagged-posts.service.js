import AppError from "../../../core/errors/app-error.js";
import ProfilesRepository from "../repositories/profiles.repository.js";
import Repository from "../repositories/tagged-posts.repository.js";
import { decodeCursor, encodeCursor } from "../../../shared/utils/cursor.js";

class TaggedPostsService {
  async list({ username, viewerUserId = null, limit = 20, cursor = null }) {
    const decoded = decodeCursor(cursor);
    let targetUserId = viewerUserId;
    if (username) {
      const profile = await ProfilesRepository.findByUsername(username);
      if (!profile) {
        throw new AppError({ code: "USER_PROFILE_NOT_FOUND",
          message: "User profile not found.", statusCode: 404 });
      }
      targetUserId = profile.user_id;
    }
    const result = await Repository.list({ targetUserId, viewerUserId, limit, cursor: decoded });
    return { posts: result.posts, pagination: {
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
    } };
  }
}

export default new TaggedPostsService();
