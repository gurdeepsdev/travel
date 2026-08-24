import { jest } from "@jest/globals";
import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const POST_ID =
  "550e8400-e29b-41d4-a716-446655440000";

const USER_ID =
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const repositoryMock = {
  add: jest.fn(),
  remove: jest.fn(),
  exists: jest.fn(),
  countByPostId: jest.fn(),
  listByPost: jest.fn(),
};

const accessServiceMock = {
  assertCanInteract: jest.fn(),
  createNotFoundError: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-been-there.repository.js",
  () => ({
    default: repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-access.service.js",
  () => ({
    default: accessServiceMock,
  }),
);

const { default: PostBeenThereService } =
  await import(
    "../../../src/modules/posts/services/post-been-there.service.js"
  );

function createNotFoundError() {
  return Object.assign(
    new Error("Post not found."),
    {
      code: "POST.NOT_FOUND",
      statusCode: 404,
    },
  );
}

describe("PostBeenThereService", () => {
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
        createNotFoundError,
      );
  });

  describe("setBeenThere", () => {
    test(
      "sets Been There and returns canonical state",
      async () => {
        repositoryMock.add.mockResolvedValue({
          created: true,
          row: {
            post_id: POST_ID,
            user_id: USER_ID,
          },
        });

        repositoryMock.exists
          .mockResolvedValue(true);

        repositoryMock.countByPostId
          .mockResolvedValue(4);

        const result =
          await PostBeenThereService
            .setBeenThere({
              postId: POST_ID,
              userId: USER_ID,
            });

        expect(
          accessServiceMock.assertCanInteract,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(
          repositoryMock.add,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(result).toEqual({
          postId: POST_ID,
          viewerBeenThere: true,
          beenThereCount: 4,
        });
      },
    );

    test(
      "is idempotent when the row already exists",
      async () => {
        repositoryMock.add.mockResolvedValue({
          created: false,
          row: null,
        });

        repositoryMock.exists
          .mockResolvedValue(true);

        repositoryMock.countByPostId
          .mockResolvedValue(4);

        const result =
          await PostBeenThereService
            .setBeenThere({
              postId: POST_ID,
              userId: USER_ID,
            });

        expect(result.viewerBeenThere)
          .toBe(true);

        expect(result.beenThereCount)
          .toBe(4);
      },
    );

    test(
      "converts a foreign-key race into post not found",
      async () => {
        repositoryMock.add.mockRejectedValue(
          Object.assign(
            new Error("Foreign key violation"),
            {
              code: "23503",
            },
          ),
        );

        await expect(
          PostBeenThereService.setBeenThere({
            postId: POST_ID,
            userId: USER_ID,
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.exists,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "does not write when access is denied",
      async () => {
        accessServiceMock
          .assertCanInteract
          .mockRejectedValue(
            createNotFoundError(),
          );

        await expect(
          PostBeenThereService.setBeenThere({
            postId: POST_ID,
            userId: USER_ID,
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
        });

        expect(
          repositoryMock.add,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("removeBeenThere", () => {
    test(
      "removes Been There and returns canonical state",
      async () => {
        repositoryMock.remove
          .mockResolvedValue({
            removed: true,
            row: {
              post_id: POST_ID,
              user_id: USER_ID,
            },
          });

        repositoryMock.exists
          .mockResolvedValue(false);

        repositoryMock.countByPostId
          .mockResolvedValue(3);

        const result =
          await PostBeenThereService
            .removeBeenThere({
              postId: POST_ID,
              userId: USER_ID,
            });

        expect(
          repositoryMock.remove,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(result).toEqual({
          postId: POST_ID,
          viewerBeenThere: false,
          beenThereCount: 3,
        });
      },
    );

    test(
      "is idempotent when no row exists",
      async () => {
        repositoryMock.remove
          .mockResolvedValue({
            removed: false,
            row: null,
          });

        repositoryMock.exists
          .mockResolvedValue(false);

        repositoryMock.countByPostId
          .mockResolvedValue(0);

        const result =
          await PostBeenThereService
            .removeBeenThere({
              postId: POST_ID,
              userId: USER_ID,
            });

        expect(result).toEqual({
          postId: POST_ID,
          viewerBeenThere: false,
          beenThereCount: 0,
        });
      },
    );
  });

  describe("getPostBeenThere", () => {
  test(
    "returns the visitor list",
    async () => {
      const row = {
        id:
          "550e8400-e29b-41d4-a716-446655440000",
        post_id: POST_ID,
        user_id: USER_ID,
        created_at:
          new Date(
            "2026-08-03T10:00:00Z",
          ),
        cursor_created_at:
          "2026-08-03 10:00:00",
        username: "traveller",
        display_name: "Traveller",
        is_verified: false,
        is_private: false,
        profile_photo_id: null,
        viewer_is_self: true,
        relationship_status: "SELF",
      };

      repositoryMock.listByPost
        .mockResolvedValue({
          rows: [row],
          hasMore: false,
          lastRow: row,
        });

      repositoryMock.countByPostId
        .mockResolvedValue(1);

      const result =
        await PostBeenThereService
          .getPostBeenThere({
            postId: POST_ID,
            viewerUserId: USER_ID,
            limit: 20,
          });

      expect(
        repositoryMock.listByPost,
      ).toHaveBeenCalledWith({
        postId: POST_ID,
        viewerUserId: USER_ID,
        limit: 20,
        cursor: null,
      });

      expect(result).toMatchObject({
        postId: POST_ID,
        beenThereCount: 1,
        visitors: [
          {
            user: {
              id: USER_ID,
              viewerIsSelf: true,
              relationship: {
                status: "SELF",
                connectionId: null,
                requestId: null,
              },
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
      const lastRow = {
        id:
          "550e8400-e29b-41d4-a716-446655440000",
        post_id: POST_ID,
        user_id: USER_ID,
        created_at:
          new Date(
            "2026-08-03T04:30:00Z",
          ),
        cursor_created_at:
          "2026-08-03 10:00:00.123456",
        username: "traveller",
        profile_photo_id: null,
      };

      repositoryMock.listByPost
        .mockResolvedValue({
          rows: [lastRow],
          hasMore: true,
          lastRow,
        });

      repositoryMock.countByPostId
        .mockResolvedValue(2);

      const result =
        await PostBeenThereService
          .getPostBeenThere({
            postId: POST_ID,
            viewerUserId: USER_ID,
            limit: 1,
          });

      expect(
        result.pagination.hasMore,
      ).toBe(true);

      expect(
        decodeCursor(
          result.pagination.nextCursor,
        ),
      ).toEqual({
        createdAt:
          "2026-08-03 10:00:00.123456",
        id: lastRow.id,
      });
    },
  );

  test(
    "rejects a malformed cursor",
    async () => {
      await expect(
        PostBeenThereService
          .getPostBeenThere({
            postId: POST_ID,
            viewerUserId: USER_ID,
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
