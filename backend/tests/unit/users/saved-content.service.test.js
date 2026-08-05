import { jest } from "@jest/globals";

import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const TARGET_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const VIEWER_USER_ID =
  "b3fe5214-e569-4300-8509-589785ad86f2";

const USERNAME =
  "user_94567b08";

const SAVED_ITEM_ID =
  "2e5b2039-ca98-46a8-b931-c75cec123d21";

  const POST_ID =
  "44444444-4444-4444-8444-444444444444";

const PLACE_ID =
  "72bf8c7b-c684-4046-9f97-cfb1f569e59a";

const repositoryMock = {
  listMySavedPostReferences:
    jest.fn(),

  findProfileAccessContext:
    jest.fn(),

  listUserSavedPlaces:
    jest.fn(),
};

const postsRepositoryMock = {
  getPostsByIds:
    jest.fn(),
};
jest.unstable_mockModule(
  "../../../src/modules/users/repositories/saved-content.repository.js",
  () => ({
    default: repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/posts.repository.js",
  () => ({
    default: postsRepositoryMock,
  }),
);

const { default: SavedContentService } =
  await import(
    "../../../src/modules/users/services/saved-content.service.js"
  );

function createProfile(
  overrides = {},
) {
  return {
    user_id: TARGET_USER_ID,
    username: USERNAME,
    is_private: false,
    viewer_is_owner: false,
    has_block_relationship: false,
    ...overrides,
  };
}

function createPlaceRow(
  overrides = {},
) {
  return {
    saved_item_id: SAVED_ITEM_ID,
    saved_at:
      new Date(
        "2026-08-03T10:00:00Z",
      ),
    cursor_created_at:
      "2026-08-03 10:00:00.000000",

    id: PLACE_ID,
    name: "DLF Mall of India",
    description:
      "A large shopping destination.",
    address:
      "Sector 18, Noida, India",
    latitude: 28.5672,
    longitude: 77.321,
    rating: 4.5,
    review_count: "1250",
    is_verified: true,
    is_closed: false,
    image_id: null,

    ...overrides,
  };
}
function createSavedPostReference(
  overrides = {},
) {
  return {
    saved_item_id:
      SAVED_ITEM_ID,

    saved_at:
      new Date(
        "2026-08-03T10:00:00Z",
      ),

    cursor_created_at:
      "2026-08-03 10:00:00.000000",

    post_id:
      POST_ID,

    ...overrides,
  };
}
describe("SavedContentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    repositoryMock
  .listMySavedPostReferences
  .mockResolvedValue({
    rows: [
      createSavedPostReference(),
    ],
    hasMore: false,
    lastRow: null,
  });

postsRepositoryMock
  .getPostsByIds
  .mockResolvedValue([
    {
      id: POST_ID,
      caption:
        "Two travel plans for Noida.",
      viewerState: {
        saved: true,
      },
    },
  ]);

    repositoryMock
      .findProfileAccessContext
      .mockResolvedValue(
        createProfile(),
      );

    repositoryMock
      .listUserSavedPlaces
      .mockResolvedValue({
        rows: [createPlaceRow()],
        hasMore: false,
        lastRow: null,
      });
  });

  describe("getMySavedPosts", () => {
  test(
    "returns complete saved posts in saved-item order",
    async () => {
      const result =
        await SavedContentService
          .getMySavedPosts({
            userId:
              TARGET_USER_ID,
            limit: 20,
            cursor: null,
          });

      expect(
        repositoryMock
          .listMySavedPostReferences,
      ).toHaveBeenCalledWith({
        userId:
          TARGET_USER_ID,
        limit: 20,
        cursor: null,
      });

      expect(
        postsRepositoryMock
          .getPostsByIds,
      ).toHaveBeenCalledWith({
        postIds: [POST_ID],
        viewerUserId:
          TARGET_USER_ID,
      });

      expect(result).toEqual({
        posts: [
          {
            id: POST_ID,
            caption:
              "Two travel plans for Noida.",
            viewerState: {
              saved: true,
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
    "returns an empty saved-post list",
    async () => {
      repositoryMock
        .listMySavedPostReferences
        .mockResolvedValue({
          rows: [],
          hasMore: false,
          lastRow: null,
        });

      postsRepositoryMock
        .getPostsByIds
        .mockResolvedValue([]);

      const result =
        await SavedContentService
          .getMySavedPosts({
            userId:
              TARGET_USER_ID,
          });

      expect(result).toEqual({
        posts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
        },
      });

      expect(
        postsRepositoryMock
          .getPostsByIds,
      ).toHaveBeenCalledWith({
        postIds: [],
        viewerUserId:
          TARGET_USER_ID,
      });
    },
  );

  test(
    "creates a cursor from the last saved item",
    async () => {
      const lastRow =
        createSavedPostReference();

      repositoryMock
        .listMySavedPostReferences
        .mockResolvedValue({
          rows: [lastRow],
          hasMore: true,
          lastRow,
        });

      const result =
        await SavedContentService
          .getMySavedPosts({
            userId:
              TARGET_USER_ID,
            limit: 1,
          });

      expect(
        decodeCursor(
          result.pagination.nextCursor,
        ),
      ).toEqual({
        createdAt:
          lastRow.cursor_created_at,
        id:
          SAVED_ITEM_ID,
      });
    },
  );

  test(
    "rejects a malformed cursor before querying",
    async () => {
      await expect(
        SavedContentService
          .getMySavedPosts({
            userId:
              TARGET_USER_ID,
            cursor: "invalid",
          }),
      ).rejects.toMatchObject({
        code:
          "COMMON.INVALID_CURSOR",
        statusCode: 400,
      });

      expect(
        repositoryMock
          .listMySavedPostReferences,
      ).not.toHaveBeenCalled();

      expect(
        postsRepositoryMock
          .getPostsByIds,
      ).not.toHaveBeenCalled();
    },
  );
});

  describe("getUserSavedPlaces", () => {
    test(
      "returns public saved places for an anonymous viewer",
      async () => {
        const result =
          await SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId: null,
              limit: 20,
              cursor: null,
            });

        expect(
          repositoryMock
            .findProfileAccessContext,
        ).toHaveBeenCalledWith({
          username: USERNAME,
          viewerUserId: null,
        });

        expect(
          repositoryMock
            .listUserSavedPlaces,
        ).toHaveBeenCalledWith({
          targetUserId:
            TARGET_USER_ID,
          limit: 20,
          cursor: null,
        });

        expect(result).toMatchObject({
          username: USERNAME,
          places: [
            {
              id: PLACE_ID,
              title:
                "DLF Mall of India",
              image: null,
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
        const lastRow =
          createPlaceRow();

        repositoryMock
          .listUserSavedPlaces
          .mockResolvedValue({
            rows: [lastRow],
            hasMore: true,
            lastRow,
          });

        const result =
          await SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId:
                VIEWER_USER_ID,
              limit: 1,
              cursor: null,
            });

        expect(
          decodeCursor(
            result.pagination.nextCursor,
          ),
        ).toEqual({
          createdAt:
            lastRow.cursor_created_at,
          id: SAVED_ITEM_ID,
        });
      },
    );

    test(
      "hides a private profile from another viewer",
      async () => {
        repositoryMock
          .findProfileAccessContext
          .mockResolvedValue(
            createProfile({
              is_private: true,
            }),
          );

        const result =
          await SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(result.places).toEqual([]);

        expect(
          repositoryMock
            .listUserSavedPlaces,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "allows an owner to view their private profile",
      async () => {
        repositoryMock
          .findProfileAccessContext
          .mockResolvedValue(
            createProfile({
              is_private: true,
              viewer_is_owner: true,
            }),
          );

        const result =
          await SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId:
                TARGET_USER_ID,
            });

        expect(result.places)
          .toHaveLength(1);
      },
    );

    test(
      "hides saved places across a block relationship",
      async () => {
        repositoryMock
          .findProfileAccessContext
          .mockResolvedValue(
            createProfile({
              has_block_relationship:
                true,
            }),
          );

        const result =
          await SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(result.places).toEqual([]);

        expect(
          repositoryMock
            .listUserSavedPlaces,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "returns not found for a missing profile",
      async () => {
        repositoryMock
          .findProfileAccessContext
          .mockResolvedValue(null);

        await expect(
          SavedContentService
            .getUserSavedPlaces({
              username: "missing_user",
              viewerUserId: null,
            }),
        ).rejects.toMatchObject({
          code:
            "USER_PROFILE_NOT_FOUND",
          statusCode: 404,
        });
      },
    );

    test(
      "rejects a malformed cursor",
      async () => {
        await expect(
          SavedContentService
            .getUserSavedPlaces({
              username: USERNAME,
              viewerUserId: null,
              cursor: "invalid",
            }),
        ).rejects.toMatchObject({
          code:
            "COMMON.INVALID_CURSOR",
          statusCode: 400,
        });

        expect(
          repositoryMock
            .listUserSavedPlaces,
        ).not.toHaveBeenCalled();
      },
    );
  });
});