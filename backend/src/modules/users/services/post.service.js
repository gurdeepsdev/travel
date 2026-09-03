// import { PostsRepository } from "../repositories/index.js";

// class PostService {
//   async getMyPosts({
//     userId,
//     limit,
//     cursor = null,
//   }) {
//     const result = await PostsRepository.getMyPosts({
//         userId,
//         limit,
//         cursor,
//       });
      
//       return {
//         posts: result.rows,
//         pagination: {
//           hasMore: result.hasMore,
//           nextCursor: result.nextCursor,
//         },
//       };
//   }
// }

// export default new PostService();

import {
    PostsRepository,
    profilesRepository,
  } from "../repositories/index.js";

import ConnectionsRepository
  from "../repositories/connections.repository.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";
  
  class PostService {
    /**
     * Fetch authenticated user's own posts.
     */
    async getMyPosts({
      userId,
      limit,
      cursor = null,
    }) {
      const decodedCursor =
        decodeCursor(cursor);

      const result =
        await PostsRepository.getMyPosts({
          userId,
          limit,
          cursor:
            decodedCursor,
        });
  
      return {
        posts: result.rows,
        pagination: {
          hasMore: result.hasMore,
          nextCursor:
            result.hasMore &&
            result.nextCursor
              ? encodeCursor(
                  result.nextCursor,
                )
              : null,
        },
      };
    }
  
    /**
     * Fetch posts shown on another user's profile.
     */
    async getUserPosts({
      username,
      viewerUserId = null,
      limit = 20,
      cursor = null,
    }) {
      const decodedCursor =
        decodeCursor(cursor);

      const normalizedUsername =
        typeof username === "string"
          ? username.trim()
          : "";
  
      if (!normalizedUsername) {
        const error =
          new Error("Username is required.");
  
        error.statusCode = 400;
        error.code = "USERNAME_REQUIRED";
        error.isOperational = true;
  
        throw error;
      }
  
      const safeLimit = Math.min(
        Math.max(Number(limit) || 20, 1),
        50,
      );
  
      const profile =
        await profilesRepository.findByUsername(
          normalizedUsername,
        );
  
      if (!profile) {
        const error =
          new Error("User profile not found.");
  
        error.statusCode = 404;
        error.code = "USER_PROFILE_NOT_FOUND";
        error.isOperational = true;
  
        throw error;
      }
  
      const targetUserId = profile.user_id;
  
      const isOwner =
        viewerUserId &&
        String(viewerUserId) ===
          String(targetUserId);
  
         let relationshipContext = {
        is_connected:
          false,

        is_blocked:
          false,
      };

      /*
       * Owner access requires no relationship lookup.
       * Anonymous viewers cannot have a connection.
       */
      if (
        !isOwner &&
        viewerUserId
      ) {
        relationshipContext =
          await ConnectionsRepository
            .getRelationshipContext({
              userId:
                viewerUserId,

              otherUserId:
                targetUserId,
            });
      }

      /*
       * Blocking takes priority over both public
       * profile visibility and connection state.
       */
      if (
        !isOwner &&
        relationshipContext.is_blocked ===
          true
      ) {
        return {
          posts: [],

          pagination: {
            hasMore:
              false,

            nextCursor:
              null,
          },
        };
      }

      /*
       * A private profile is available to its owner
       * and currently connected authenticated users.
       */
      if (
        profile.is_private &&
        !isOwner &&
        relationshipContext.is_connected !==
          true
      ) {
        return {
          posts: [],

          pagination: {
            hasMore:
              false,

            nextCursor:
              null,
          },
        };
      }
  
      const result =
        await PostsRepository.getUserPosts({
          targetUserId,
          viewerUserId,
          allowPrivatePosts:
            !isOwner &&
            profile.is_private === true &&
            relationshipContext
              .is_connected === true,
          limit: safeLimit,
          cursor:
            decodedCursor,
        });
  
      return {
        posts: result.rows,
        pagination: {
          hasMore: result.hasMore,
          nextCursor:
            result.hasMore &&
            result.nextCursor
              ? encodeCursor(
                  result.nextCursor,
                )
              : null,
        },
      };
    }
  }
  
  export default new PostService();
