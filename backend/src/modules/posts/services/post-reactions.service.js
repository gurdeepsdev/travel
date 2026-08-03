import PostReactionsMapper from "../mappers/post-reactions.mapper.js";
import PostReactionsRepository from "../repositories/post-reactions.repository.js";

import PostAccessService from "./post-access.service.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

class PostReactionsService {
async getPostReactions({
  postId,
  viewerUserId = null,
  reactionType = null,
  limit = 20,
  cursor = null,
}) {
  await PostAccessService.assertCanInteract({
    postId,
    userId: viewerUserId,
  });

  const decodedCursor =
    decodeCursor(cursor);

  const [
    listResult,
    summaryRows,
  ] = await Promise.all([
    PostReactionsRepository.listByPost({
      postId,
      viewerUserId,
      reactionType,
      limit,
      cursor: decodedCursor,
    }),

    PostReactionsRepository
      .getReactionSummary(postId),
  ]);

  const nextCursor =
    listResult.hasMore &&
    listResult.lastRow
      ? encodeCursor({
         createdAt:
  listResult.lastRow
    .cursor_created_at ??
  listResult.lastRow.created_at,
          id:
            listResult.lastRow.id,
        })
      : null;

  return PostReactionsMapper
    .toListResponse({
      postId,
      reactionType,
      rows: listResult.rows,
      summaryRows,
      hasMore: listResult.hasMore,
      nextCursor,
    });
}



  async setReaction({
    postId,
    userId,
    reactionType,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    let reaction;

    try {
      reaction =
        await PostReactionsRepository
          .upsertReaction({
            postId,
            userId,
            reactionType,
          });
    } catch (error) {
      /*
       * The post may have been deleted after authorization
       * but before PostgreSQL processes the insert.
       */
      if (error.code === "23503") {
        throw PostAccessService
          .createNotFoundError();
      }

      throw error;
    }

    const summaryRows =
      await PostReactionsRepository
        .getReactionSummary(postId);

    return PostReactionsMapper
      .toMutationResponse({
        postId,
        reaction,
        summaryRows,
      });
  }

  async removeReaction({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    await PostReactionsRepository
      .deleteReaction({
        postId,
        userId,
      });

    const summaryRows =
      await PostReactionsRepository
        .getReactionSummary(postId);

    return PostReactionsMapper
      .toMutationResponse({
        postId,
        reaction: null,
        summaryRows,
      });
  }
}

export default new PostReactionsService();