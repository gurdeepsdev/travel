import { jest } from "@jest/globals";

const COMMENT_ID =
  "0044c566-a39a-40a1-9b90-a7d256ef32f9";

const POST_ID =
  "44444444-4444-4444-8444-444444444444";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const COMMENT_AUTHOR_ID =
  "a4bfc312-1065-4377-adf7-98792cd212a3";

const repositoryMock = {
  findCommentContext: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
  getState: jest.fn(),
};

const postAccessServiceMock = {
  assertCanInteract: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/comment-likes.repository.js",
  () => ({
    default: repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-access.service.js",
  () => ({
    default: postAccessServiceMock,
  }),
);

const { default: CommentLikesService } =
  await import(
    "../../../src/modules/posts/services/comment-likes.service.js"
  );

function createCommentContext(
  overrides = {},
) {
  return {
    id: COMMENT_ID,
    post_id: POST_ID,
    user_id: COMMENT_AUTHOR_ID,
    has_block_relationship: false,
    ...overrides,
  };
}

function createPostNotFoundError() {
  return Object.assign(
    new Error("Post not found."),
    {
      code: "POST.NOT_FOUND",
      statusCode: 404,
    },
  );
}

describe("CommentLikesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    repositoryMock
      .findCommentContext
      .mockResolvedValue(
        createCommentContext(),
      );

    postAccessServiceMock
      .assertCanInteract
      .mockResolvedValue({
        id: POST_ID,
      });
  });

  describe("setLike", () => {
    test(
      "likes a comment and returns canonical state",
      async () => {
        repositoryMock.add
          .mockResolvedValue({
            id:
              "94000000-0000-4000-8000-000000000001",
          });

        repositoryMock.getState
          .mockResolvedValue({
            id: COMMENT_ID,
            like_count: "1",
            viewer_has_liked: true,
          });

        const result =
          await CommentLikesService.setLike({
            commentId: COMMENT_ID,
            userId: USER_ID,
          });

        expect(
          repositoryMock
            .findCommentContext,
        ).toHaveBeenCalledWith({
          commentId: COMMENT_ID,
          viewerUserId: USER_ID,
        });

        expect(
          postAccessServiceMock
            .assertCanInteract,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(
          repositoryMock.add,
        ).toHaveBeenCalledWith({
          commentId: COMMENT_ID,
          userId: USER_ID,
        });

        expect(result).toEqual({
          commentId: COMMENT_ID,
          viewerHasLiked: true,
          likeCount: 1,
        });
      },
    );

    test(
      "is idempotent when the like already exists",
      async () => {
        repositoryMock.add
          .mockResolvedValue(null);

        repositoryMock.getState
          .mockResolvedValue({
            id: COMMENT_ID,
            like_count: "1",
            viewer_has_liked: true,
          });

        const result =
          await CommentLikesService.setLike({
            commentId: COMMENT_ID,
            userId: USER_ID,
          });

        expect(result).toEqual({
          commentId: COMMENT_ID,
          viewerHasLiked: true,
          likeCount: 1,
        });
      },
    );

    test(
      "maps a foreign-key race to comment not found",
      async () => {
        repositoryMock.add
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
          CommentLikesService.setLike({
            commentId: COMMENT_ID,
            userId: USER_ID,
          }),
        ).rejects.toMatchObject({
          code: "COMMENT.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.getState,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("removeLike", () => {
    test(
      "removes a like and returns canonical state",
      async () => {
        repositoryMock.remove
          .mockResolvedValue({
            id:
              "94000000-0000-4000-8000-000000000001",
          });

        repositoryMock.getState
          .mockResolvedValue({
            id: COMMENT_ID,
            like_count: "0",
            viewer_has_liked: false,
          });

        const result =
          await CommentLikesService
            .removeLike({
              commentId: COMMENT_ID,
              userId: USER_ID,
            });

        expect(
          repositoryMock.remove,
        ).toHaveBeenCalledWith({
          commentId: COMMENT_ID,
          userId: USER_ID,
        });

        expect(result).toEqual({
          commentId: COMMENT_ID,
          viewerHasLiked: false,
          likeCount: 0,
        });
      },
    );

    test(
      "is idempotent when no like exists",
      async () => {
        repositoryMock.remove
          .mockResolvedValue(null);

        repositoryMock.getState
          .mockResolvedValue({
            id: COMMENT_ID,
            like_count: "0",
            viewer_has_liked: false,
          });

        const result =
          await CommentLikesService
            .removeLike({
              commentId: COMMENT_ID,
              userId: USER_ID,
            });

        expect(result.viewerHasLiked)
          .toBe(false);

        expect(result.likeCount).toBe(0);
      },
    );
  });

  test(
    "hides a missing comment",
    async () => {
      repositoryMock
        .findCommentContext
        .mockResolvedValue(null);

      await expect(
        CommentLikesService.setLike({
          commentId: COMMENT_ID,
          userId: USER_ID,
        }),
      ).rejects.toMatchObject({
        code: "COMMENT.NOT_FOUND",
        statusCode: 404,
      });

      expect(
        postAccessServiceMock
          .assertCanInteract,
      ).not.toHaveBeenCalled();

      expect(
        repositoryMock.add,
      ).not.toHaveBeenCalled();
    },
  );

  test(
    "prevents interaction across a block relationship",
    async () => {
      repositoryMock
        .findCommentContext
        .mockResolvedValue(
          createCommentContext({
            has_block_relationship: true,
          }),
        );

      await expect(
        CommentLikesService.setLike({
          commentId: COMMENT_ID,
          userId: USER_ID,
        }),
      ).rejects.toMatchObject({
        code: "COMMENT.NOT_FOUND",
        statusCode: 404,
      });

      expect(
        postAccessServiceMock
          .assertCanInteract,
      ).not.toHaveBeenCalled();

      expect(
        repositoryMock.add,
      ).not.toHaveBeenCalled();
    },
  );

  test(
    "does not write when post access is denied",
    async () => {
      postAccessServiceMock
        .assertCanInteract
        .mockRejectedValue(
          createPostNotFoundError(),
        );

      await expect(
        CommentLikesService.setLike({
          commentId: COMMENT_ID,
          userId: USER_ID,
        }),
      ).rejects.toMatchObject({
        code: "POST.NOT_FOUND",
        statusCode: 404,
      });

      expect(
        repositoryMock.add,
      ).not.toHaveBeenCalled();
    },
  );
});