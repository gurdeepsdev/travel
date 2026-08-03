import { jest } from "@jest/globals";
import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const repositoryMock = {
  upsertReaction: jest.fn(),
  deleteReaction: jest.fn(),
  findUserReaction: jest.fn(),
  getReactionSummary: jest.fn(),
  listByPost: jest.fn(),
};
  
  const postsRepositoryMock = {
    findAccessContext: jest.fn(),
  };

  jest.unstable_mockModule(
    "../../../src/modules/posts/repositories/post-reactions.repository.js",
    () => ({
      default: repositoryMock,
    }),
  );
  

  jest.unstable_mockModule(
    "../../../src/modules/posts/repositories/posts.repository.js",
    () => ({
      default: postsRepositoryMock,
    }),
  );

const { default: PostReactionsService } =
  await import(
    "../../../src/modules/posts/services/post-reactions.service.js"
  );

const POST_ID =
  "550e8400-e29b-41d4-a716-446655440000";

const OWNER_ID =
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const VIEWER_ID =
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function createPost(overrides = {}) {
  return {
    id: POST_ID,
    user_id: OWNER_ID,
    visibility: "PUBLIC",
    owner_profile_is_private: false,
    has_block_relationship: false,
    ...overrides,
  };
}

function createReaction(overrides = {}) {
  return {
    id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    post_id: POST_ID,
    user_id: VIEWER_ID,
    reaction_type: "LOVE",
    created_at:
      new Date("2026-07-31T10:00:00.000Z"),
    updated_at:
      new Date("2026-07-31T10:00:00.000Z"),
    ...overrides,
  };
}

describe("PostReactionsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("setReaction", () => {
    test(
      "creates or updates a reaction on an accessible public post",
      async () => {
        postsRepositoryMock
        .findAccessContext
          .mockResolvedValue(createPost());

        repositoryMock
          .upsertReaction
          .mockResolvedValue(createReaction());

        repositoryMock
          .getReactionSummary
          .mockResolvedValue([
            {
              reaction_type: "LIKE",
              reaction_count: "3",
            },
            {
              reaction_type: "LOVE",
              reaction_count: "2",
            },
          ]);

        const result =
          await PostReactionsService.setReaction({
            postId: POST_ID,
            userId: VIEWER_ID,
            reactionType: "LOVE",
          });

        expect(
          repositoryMock.upsertReaction,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: VIEWER_ID,
          reactionType: "LOVE",
        });

        expect(result).toMatchObject({
          postId: POST_ID,
          viewerReaction: "LOVE",
          reactionCount: 5,
          reactionSummary: {
            LIKE: 3,
            LOVE: 2,
          },
        });
      },
    );

    test(
      "allows the owner to react to their private post",
      async () => {
        postsRepositoryMock
  .findAccessContext
          .mockResolvedValue(
            createPost({
              visibility: "PRIVATE",
              owner_profile_is_private: true,
            }),
          );

        repositoryMock
          .upsertReaction
          .mockResolvedValue(
            createReaction({
              user_id: OWNER_ID,
              reaction_type: "LIKE",
            }),
          );

        repositoryMock
          .getReactionSummary
          .mockResolvedValue([
            {
              reaction_type: "LIKE",
              reaction_count: "1",
            },
          ]);

        const result =
          await PostReactionsService.setReaction({
            postId: POST_ID,
            userId: OWNER_ID,
            reactionType: "LIKE",
          });

        expect(result.viewerReaction).toBe(
          "LIKE",
        );
      },
    );

    test(
      "hides an inaccessible private post",
      async () => {
        postsRepositoryMock
  .findAccessContext
          .mockResolvedValue(
            createPost({
              visibility: "PRIVATE",
            }),
          );

        await expect(
          PostReactionsService.setReaction({
            postId: POST_ID,
            userId: VIEWER_ID,
            reactionType: "LOVE",
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.upsertReaction,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "prevents reactions across a block relationship",
      async () => {
        postsRepositoryMock
        .findAccessContext
          .mockResolvedValue(
            createPost({
              has_block_relationship: true,
            }),
          );

        await expect(
          PostReactionsService.setReaction({
            postId: POST_ID,
            userId: VIEWER_ID,
            reactionType: "LOVE",
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.upsertReaction,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("removeReaction", () => {
    test(
      "is successful when no existing reaction is found",
      async () => {
        postsRepositoryMock
        .findAccessContext
          .mockResolvedValue(createPost());

        repositoryMock
          .deleteReaction
          .mockResolvedValue(null);

        repositoryMock
          .getReactionSummary
          .mockResolvedValue([]);

        const result =
          await PostReactionsService.removeReaction({
            postId: POST_ID,
            userId: VIEWER_ID,
          });

        expect(
          repositoryMock.deleteReaction,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: VIEWER_ID,
        });

        expect(result).toMatchObject({
          postId: POST_ID,
          viewerReaction: null,
          reaction: null,
          reactionCount: 0,
        });
      },
    );
  });

describe("getPostReactions", () => {
  test(
    "returns an unfiltered reaction list",
    async () => {
      postsRepositoryMock
        .findAccessContext
        .mockResolvedValue(createPost());

      const reactionRow = {
        id:
          "550e8400-e29b-41d4-a716-446655440000",
        post_id: POST_ID,
        user_id: VIEWER_ID,
        reaction_type: "LIKE",
        created_at:
          new Date(
            "2026-08-03T10:00:00Z",
          ),
        updated_at:
          new Date(
            "2026-08-03T10:00:00Z",
          ),
        username: "traveller",
        display_name: "Traveller",
        is_verified: false,
        is_private: false,
        profile_photo_id: null,
        viewer_is_self: true,
      };

      repositoryMock.listByPost
        .mockResolvedValue({
          rows: [reactionRow],
          hasMore: false,
          lastRow: reactionRow,
        });

      repositoryMock.getReactionSummary
        .mockResolvedValue([
          {
            reaction_type: "LIKE",
            reaction_count: "1",
          },
        ]);

      const result =
        await PostReactionsService
          .getPostReactions({
            postId: POST_ID,
            viewerUserId: VIEWER_ID,
            limit: 20,
          });

      expect(
        repositoryMock.listByPost,
      ).toHaveBeenCalledWith({
        postId: POST_ID,
        viewerUserId: VIEWER_ID,
        reactionType: null,
        limit: 20,
        cursor: null,
      });

      expect(result).toMatchObject({
        postId: POST_ID,
        reactionCount: 1,
        reactions: [
          {
            type: "LIKE",
            user: {
              id: VIEWER_ID,
              viewerIsSelf: true,
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
    "filters by type and creates a next cursor",
    async () => {
      postsRepositoryMock
        .findAccessContext
        .mockResolvedValue(createPost());

      const lastRow = {
        id:
          "550e8400-e29b-41d4-a716-446655440000",
        post_id: POST_ID,
        user_id: VIEWER_ID,
        reaction_type: "LOVE",
        created_at:
          new Date(
            "2026-08-03T09:00:00Z",
          ),
        username: "traveller",
        profile_photo_id: null,
      };

      repositoryMock.listByPost
        .mockResolvedValue({
          rows: [lastRow],
          hasMore: true,
          lastRow,
        });

      repositoryMock.getReactionSummary
        .mockResolvedValue([
          {
            reaction_type: "LOVE",
            reaction_count: "2",
          },
        ]);

      const result =
        await PostReactionsService
          .getPostReactions({
            postId: POST_ID,
            viewerUserId: VIEWER_ID,
            reactionType: "LOVE",
            limit: 1,
          });

      expect(result.filter).toEqual({
        reactionType: "LOVE",
      });

      expect(
        result.pagination.hasMore,
      ).toBe(true);

      expect(
        typeof result.pagination.nextCursor,
      ).toBe("string");

      expect(
        decodeCursor(
          result.pagination.nextCursor,
        ),
      ).toEqual({
        createdAt:
          "2026-08-03T09:00:00.000Z",
        id: lastRow.id,
      });
    },
  );

  test(
    "rejects a malformed cursor",
    async () => {
      postsRepositoryMock
        .findAccessContext
        .mockResolvedValue(createPost());

      await expect(
        PostReactionsService
          .getPostReactions({
            postId: POST_ID,
            viewerUserId: VIEWER_ID,
            cursor: "invalid",
          }),
      ).rejects.toMatchObject({
        code:
          "COMMON.INVALID_CURSOR",
        statusCode: 400,
      });

      expect(
        repositoryMock.listByPost,
      ).not.toHaveBeenCalled();
    },
  );
});

});