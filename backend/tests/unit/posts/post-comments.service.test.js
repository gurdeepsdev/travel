import { jest } from "@jest/globals";
import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const POST_ID =
  "550e8400-e29b-41d4-a716-446655440000";

const USER_ID =
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const PARENT_COMMENT_ID =
  "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

const commentsRepositoryMock = {
  create: jest.fn(),
  listTopLevelByPost: jest.fn(),
  countByPostId: jest.fn(),
};
const accessServiceMock = {
  assertCanInteract: jest.fn(),
  createNotFoundError: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-comments.repository.js",
  () => ({
    default: commentsRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-access.service.js",
  () => ({
    default: accessServiceMock,
  }),
);

const { default: PostCommentsService } =
  await import(
    "../../../src/modules/posts/services/post-comments.service.js"
  );

function createPostNotFoundError() {
  return Object.assign(
    new Error("Post not found."),
    {
      code: "POST.NOT_FOUND",
      statusCode: 404,
    },
  );
}


function createCommentRow(overrides = {}) {
  return {
    id:
      "6ba7b813-9dad-11d1-80b4-00c04fd430c8",
    post_id: POST_ID,
    user_id: USER_ID,
    comment: "This place looks amazing!",
    parent_comment_id: null,
    like_count: "0",
    created_at:
      new Date("2026-08-02T10:00:00Z"),
    updated_at:
      new Date("2026-08-02T10:00:00Z"),
    username: "traveller",
    display_name: "Traveller",
    is_verified: false,
    profile_photo_id: null,
    cursor_created_at:
      "2026-08-02 10:00:00.000000",
    reply_count: "0",
    viewer_is_author: false,

    ...overrides,
  };
}

describe("PostCommentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    accessServiceMock
      .assertCanInteract
      .mockResolvedValue({
        id: POST_ID,
      });

    accessServiceMock
      .createNotFoundError
      .mockImplementation(
        createPostNotFoundError,
      );
  });

  describe("getPostComments", () => {
    test(
      "returns top-level comments with author and reply count",
      async () => {
        commentsRepositoryMock
          .listTopLevelByPost
          .mockResolvedValue({
            rows: [
              createCommentRow({
                reply_count: "1",
                viewer_is_author: true,
              }),
            ],
            hasMore: false,
            lastRow: null,
          });

        commentsRepositoryMock
          .countByPostId
          .mockResolvedValue(2);

        const result =
          await PostCommentsService
            .getPostComments({
              postId: POST_ID,
              viewerUserId: USER_ID,
              limit: 20,
              cursor: null,
            });

        expect(
          accessServiceMock.assertCanInteract,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(
          commentsRepositoryMock
            .listTopLevelByPost,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          viewerUserId: USER_ID,
          limit: 20,
          cursor: null,
        });

        expect(result).toMatchObject({
          postId: POST_ID,
          commentCount: 2,
          comments: [
            {
              postId: POST_ID,
              comment:
                "This place looks amazing!",
              replyCount: 1,
              viewerIsAuthor: true,
              author: {
                id: USER_ID,
                username: "traveller",
                displayName: "Traveller",
              },
            },
          ],
          pagination: {
            hasMore: false,
            nextCursor: null,
          },
        });
      },
    );

    test(
      "creates a timestamp-safe next cursor",
      async () => {
        const cursorTimestamp =
          "2026-08-02 10:00:00.123456";

        const lastRow =
          createCommentRow({
            cursor_created_at:
              cursorTimestamp,
          });

        commentsRepositoryMock
          .listTopLevelByPost
          .mockResolvedValue({
            rows: [lastRow],
            hasMore: true,
            lastRow,
          });

        commentsRepositoryMock
          .countByPostId
          .mockResolvedValue(3);

        const result =
          await PostCommentsService
            .getPostComments({
              postId: POST_ID,
              viewerUserId: null,
              limit: 1,
              cursor: null,
            });

        expect(
          result.pagination.hasMore,
        ).toBe(true);

        expect(
          result.pagination.nextCursor,
        ).toEqual(expect.any(String));

        expect(
          decodeCursor(
            result.pagination.nextCursor,
          ),
        ).toEqual({
          createdAt: cursorTimestamp,
          id: lastRow.id,
        });
      },
    );

    test(
      "rejects a malformed cursor",
      async () => {
        await expect(
          PostCommentsService
            .getPostComments({
              postId: POST_ID,
              viewerUserId: null,
              limit: 20,
              cursor: "invalid",
            }),
        ).rejects.toMatchObject({
          code: "COMMON.INVALID_CURSOR",
          statusCode: 400,
        });

        expect(
          commentsRepositoryMock
            .listTopLevelByPost,
        ).not.toHaveBeenCalled();

        expect(
          commentsRepositoryMock
            .countByPostId,
        ).not.toHaveBeenCalled();
      },
    );
  });


  test(
    "creates a top-level comment",
    async () => {
      commentsRepositoryMock.create
        .mockResolvedValue(
          createCommentRow(),
        );

      commentsRepositoryMock.countByPostId
        .mockResolvedValue(1);

      const result =
        await PostCommentsService
          .createComment({
            postId: POST_ID,
            userId: USER_ID,
            comment:
              "This place looks amazing!",
          });

      expect(
        accessServiceMock.assertCanInteract,
      ).toHaveBeenCalledWith({
        postId: POST_ID,
        userId: USER_ID,
      });

      expect(
        commentsRepositoryMock.create,
      ).toHaveBeenCalledWith({
        postId: POST_ID,
        userId: USER_ID,
        comment:
          "This place looks amazing!",
        parentCommentId: null,
      });

      expect(result).toMatchObject({
        comment: {
          postId: POST_ID,
          comment:
            "This place looks amazing!",
          parentCommentId: null,
          isReply: false,
        },
        commentCount: 1,
      });
    },
  );

  test(
    "creates a reply on the same post",
    async () => {
      commentsRepositoryMock.create
        .mockResolvedValue(
          createCommentRow({
            comment:
              "I visited it last year.",
            parent_comment_id:
              PARENT_COMMENT_ID,
          }),
        );

      commentsRepositoryMock.countByPostId
        .mockResolvedValue(2);

      const result =
        await PostCommentsService
          .createComment({
            postId: POST_ID,
            userId: USER_ID,
            comment:
              "I visited it last year.",
            parentCommentId:
              PARENT_COMMENT_ID,
          });

      expect(
        commentsRepositoryMock.create,
      ).toHaveBeenCalledWith({
        postId: POST_ID,
        userId: USER_ID,
        comment:
          "I visited it last year.",
        parentCommentId:
          PARENT_COMMENT_ID,
      });

      expect(result.comment).toMatchObject({
        parentCommentId:
          PARENT_COMMENT_ID,
        isReply: true,
      });

      expect(result.commentCount).toBe(2);
    },
  );

  test(
    "rejects a parent from another post",
    async () => {
      commentsRepositoryMock.create
        .mockResolvedValue(null);

      await expect(
        PostCommentsService.createComment({
          postId: POST_ID,
          userId: USER_ID,
          comment: "Reply text",
          parentCommentId:
            PARENT_COMMENT_ID,
        }),
      ).rejects.toMatchObject({
        code:
          "COMMENT.PARENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(
        commentsRepositoryMock.countByPostId,
      ).not.toHaveBeenCalled();
    },
  );

  test(
    "does not write when post access is denied",
    async () => {
      accessServiceMock
        .assertCanInteract
        .mockRejectedValue(
          createPostNotFoundError(),
        );

      await expect(
        PostCommentsService.createComment({
          postId: POST_ID,
          userId: USER_ID,
          comment: "Hidden comment",
        }),
      ).rejects.toMatchObject({
        code: "POST.NOT_FOUND",
        statusCode: 404,
      });

      expect(
        commentsRepositoryMock.create,
      ).not.toHaveBeenCalled();
    },
  );

  test(
    "maps a concurrently deleted parent to not found",
    async () => {
      commentsRepositoryMock.create
        .mockRejectedValue(
          Object.assign(
            new Error(
              "Foreign key violation",
            ),
            {
              code: "23503",
            },
          ),
        );

      await expect(
        PostCommentsService.createComment({
          postId: POST_ID,
          userId: USER_ID,
          comment: "Reply text",
          parentCommentId:
            PARENT_COMMENT_ID,
        }),
      ).rejects.toMatchObject({
        code:
          "COMMENT.PARENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(
        accessServiceMock.assertCanInteract,
      ).toHaveBeenCalledTimes(2);
    },
  );
});