import AppError from "../../../core/errors/app-error.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";
import PostsRepository from "../repositories/posts.repository.js";

import SavedContentMapper from "../mappers/saved-content.mapper.js";
import SavedContentRepository from "../repositories/saved-content.repository.js";

class SavedContentService {

/**
 * Returns the authenticated user's active saved
 * posts as complete post response objects.
 */
async getMySavedPosts({
  userId,
  limit = 20,
  cursor = null,
}) {
  const decodedCursor =
    decodeCursor(cursor);

  const savedReferences =
    await SavedContentRepository
      .listMySavedPostReferences({
        userId,
        limit,
        cursor: decodedCursor,
      });

  const postIds =
    savedReferences.rows.map(
      (row) => row.post_id,
    );

  const posts =
    await PostsRepository.getPostsByIds({
      postIds,
      viewerUserId: userId,
    });

  const nextCursor =
    savedReferences.hasMore &&
    savedReferences.lastRow
      ? encodeCursor({
          createdAt:
            savedReferences.lastRow
              .cursor_created_at ??
            savedReferences.lastRow
              .saved_at,

          id:
            savedReferences.lastRow
              .saved_item_id,
        })
      : null;

  return SavedContentMapper
    .toMySavedPostsResponse({
      posts,
      hasMore:
        savedReferences.hasMore,
      nextCursor,
    });
}


  /**
   * Returns public POI cards derived from a
   * profile's accessible active saved posts.
   */
  async getUserSavedPlaces({
    username,
    viewerUserId = null,
    limit = 20,
    cursor = null,
  }) {
    const normalizedUsername =
      typeof username === "string"
        ? username.trim()
        : "";

    const profile =
      await SavedContentRepository
        .findProfileAccessContext({
          username: normalizedUsername,
          viewerUserId,
        });

    if (!profile) {
      throw new AppError({
        code:
          "USER_PROFILE_NOT_FOUND",
        message:
          "User profile not found.",
        statusCode: 404,
      });
    }

    const viewerIsOwner =
      profile.viewer_is_owner === true;

    /*
     * Match the existing profile-post rule:
     * private profiles are visible only to their
     * owner until follower support is added.
     *
     * Blocked relationships also return an empty
     * list instead of exposing saved locations.
     */
    const cannotView =
      !viewerIsOwner &&
      (
        profile.is_private === true ||
        profile.has_block_relationship ===
          true
      );

    if (cannotView) {
      return SavedContentMapper
        .toPublicPlacesResponse({
          username: profile.username,
          rows: [],
          hasMore: false,
          nextCursor: null,
        });
    }

    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await SavedContentRepository
        .listUserSavedPlaces({
          targetUserId:
            profile.user_id,

          limit,
          cursor: decodedCursor,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_created_at ??
              listResult.lastRow
                .saved_at,

            id:
              listResult.lastRow
                .saved_item_id,
          })
        : null;

    return SavedContentMapper
      .toPublicPlacesResponse({
        username: profile.username,
        rows: listResult.rows,
        hasMore: listResult.hasMore,
        nextCursor,
      });
  }
}

export default new SavedContentService();