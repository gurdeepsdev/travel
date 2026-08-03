import PostBeenThereMapper from "../mappers/post-been-there.mapper.js";
import PostBeenThereRepository from "../repositories/post-been-there.repository.js";

import PostAccessService from "./post-access.service.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

class PostBeenThereService {

async getPostBeenThere({
  postId,
  viewerUserId = null,
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
    beenThereCount,
  ] = await Promise.all([
    PostBeenThereRepository.listByPost({
      postId,
      viewerUserId,
      limit,
      cursor: decodedCursor,
    }),

    PostBeenThereRepository
      .countByPostId(postId),
  ]);

  const nextCursor =
    listResult.hasMore &&
    listResult.lastRow
      ? encodeCursor({
          createdAt:
            listResult.lastRow
              .cursor_created_at ??
            listResult.lastRow
              .created_at,

          id:
            listResult.lastRow.id,
        })
      : null;

  return PostBeenThereMapper
    .toListResponse({
      postId,
      rows: listResult.rows,
      beenThereCount,
      hasMore: listResult.hasMore,
      nextCursor,
    });
}


  async setBeenThere({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    try {
      await PostBeenThereRepository.add({
        postId,
        userId,
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

    const [
      viewerBeenThere,
      beenThereCount,
    ] = await Promise.all([
      PostBeenThereRepository.exists({
        postId,
        userId,
      }),
      PostBeenThereRepository
        .countByPostId(postId),
    ]);

    return PostBeenThereMapper.toResponse({
      postId,
      viewerBeenThere,
      beenThereCount,
    });
  }

  async removeBeenThere({
    postId,
    userId,
  }) {
    await PostAccessService.assertCanInteract({
      postId,
      userId,
    });

    await PostBeenThereRepository.remove({
      postId,
      userId,
    });

    const [
      viewerBeenThere,
      beenThereCount,
    ] = await Promise.all([
      PostBeenThereRepository.exists({
        postId,
        userId,
      }),
      PostBeenThereRepository
        .countByPostId(postId),
    ]);

    return PostBeenThereMapper.toResponse({
      postId,
      viewerBeenThere,
      beenThereCount,
    });
  }
}

export default new PostBeenThereService();