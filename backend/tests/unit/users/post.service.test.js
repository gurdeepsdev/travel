import {
  jest,
} from "@jest/globals";

const OWNER_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const VIEWER_USER_ID =
  "a4bfc312-1065-4377-adf7-98792cd212a3";

const POST_ID =
  "44444444-4444-4444-8444-444444444444";

const POST_CREATED_AT =
  "2026-08-10T05:12:40.140Z";

const profilesRepositoryMock = {
  findByUsername:
    jest.fn(),
};

const postsRepositoryMock = {
  getMyPosts:
    jest.fn(),

  getUserPosts:
    jest.fn(),
};

const connectionsRepositoryMock = {
  getRelationshipContext:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/index.js",
  () => ({
    profilesRepository:
      profilesRepositoryMock,

    PostsRepository:
      postsRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/connections.repository.js",
  () => ({
    default:
      connectionsRepositoryMock,
  }),
);

const {
  default: PostService,
} = await import(
  "../../../src/modules/users/services/post.service.js"
);

function createProfile(
  overrides = {},
) {
  return {
    user_id:
      OWNER_USER_ID,

    username:
      "user_94567b08",

    is_private:
      false,

    ...overrides,
  };
}

function createPostResult() {
  return {
    rows: [
      {
        id:
          "44444444-4444-4444-8444-444444444444",

        visibility:
          "PUBLIC",
      },
    ],

    hasMore:
      false,

    nextCursor:
      null,
  };
}

describe("PostService getMyPosts pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns an opaque cursor and decodes it on the next request", async () => {
    postsRepositoryMock
      .getMyPosts
      .mockResolvedValueOnce({
        rows: [],
        hasMore: true,
        nextCursor: {
          createdAt:
            POST_CREATED_AT,
          id:
            POST_ID,
        },
      })
      .mockResolvedValueOnce(
        createPostResult(),
      );

    const firstPage =
      await PostService.getMyPosts({
        userId:
          OWNER_USER_ID,
        limit:
          20,
      });

    expect(
      typeof firstPage.pagination
        .nextCursor,
    ).toBe("string");

    await PostService.getMyPosts({
      userId:
        OWNER_USER_ID,
      limit:
        20,
      cursor:
        firstPage.pagination
          .nextCursor,
    });

    expect(
      postsRepositoryMock.getMyPosts,
    ).toHaveBeenLastCalledWith({
      userId:
        OWNER_USER_ID,
      limit:
        20,
      cursor: {
        createdAt:
          POST_CREATED_AT,
        id:
          POST_ID,
      },
    });
  });

  test("rejects an invalid cursor before querying", async () => {
    await expect(
      PostService.getMyPosts({
        userId:
          OWNER_USER_ID,
        limit:
          20,
        cursor:
          "invalid",
      }),
    ).rejects.toMatchObject({
      code:
        "COMMON.INVALID_CURSOR",
    });

    expect(
      postsRepositoryMock.getMyPosts,
    ).not.toHaveBeenCalled();
  });
});

describe(
  "PostService getUserPosts authorization",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      postsRepositoryMock
        .getUserPosts
        .mockResolvedValue(
          createPostResult(),
        );

      connectionsRepositoryMock
        .getRelationshipContext
        .mockResolvedValue({
          is_connected:
            false,

          is_blocked:
            false,
        });
    });

    test(
      "allows an owner to view a private profile without a relationship lookup",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                true,
            }),
          );

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                OWNER_USER_ID,

              limit:
                20,

              cursor:
                null,
            });

        expect(
          connectionsRepositoryMock
            .getRelationshipContext,
        ).not.toHaveBeenCalled();

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).toHaveBeenCalledWith({
          targetUserId:
            OWNER_USER_ID,

          viewerUserId:
            OWNER_USER_ID,

          allowPrivatePosts:
            false,

          limit:
            20,

          cursor:
            null,
        });

        expect(result.posts)
          .toHaveLength(1);
      },
    );

    test(
      "allows anonymous access to a public profile",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                false,
            }),
          );

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                null,
            });

        expect(
          connectionsRepositoryMock
            .getRelationshipContext,
        ).not.toHaveBeenCalled();

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).toHaveBeenCalledWith({
          targetUserId:
            OWNER_USER_ID,

          viewerUserId:
            null,

          allowPrivatePosts:
            false,

          limit:
            20,

          cursor:
            null,
        });

        expect(result.posts)
          .toHaveLength(1);
      },
    );

    test(
      "uses an opaque cursor for another user's posts",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile(),
          );

        postsRepositoryMock
          .getUserPosts
          .mockResolvedValue({
            rows: [],
            hasMore: true,
            nextCursor: {
              createdAt:
                POST_CREATED_AT,
              id:
                POST_ID,
            },
          });

        const firstPage =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",
              viewerUserId:
                null,
            });

        expect(
          typeof firstPage.pagination
            .nextCursor,
        ).toBe("string");
      },
    );

    test(
      "hides a private profile from an anonymous viewer",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                true,
            }),
          );

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                null,
            });

        expect(
          connectionsRepositoryMock
            .getRelationshipContext,
        ).not.toHaveBeenCalled();

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).not.toHaveBeenCalled();

        expect(result)
          .toEqual({
            posts: [],

            pagination: {
              hasMore:
                false,

              nextCursor:
                null,
            },
          });
      },
    );

    test(
      "hides a private profile from an unconnected viewer",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                true,
            }),
          );

        connectionsRepositoryMock
          .getRelationshipContext
          .mockResolvedValue({
            is_connected:
              false,

            is_blocked:
              false,
          });

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          connectionsRepositoryMock
            .getRelationshipContext,
        ).toHaveBeenCalledWith({
          userId:
            VIEWER_USER_ID,

          otherUserId:
            OWNER_USER_ID,
        });

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).not.toHaveBeenCalled();

        expect(result.posts)
          .toEqual([]);
      },
    );

    test(
      "allows a connected viewer through a private profile gate",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                true,
            }),
          );

        connectionsRepositoryMock
          .getRelationshipContext
          .mockResolvedValue({
            is_connected:
              true,

            is_blocked:
              false,
          });

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                VIEWER_USER_ID,

              limit:
                10,

              cursor:
                null,
            });

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).toHaveBeenCalledWith({
          targetUserId:
            OWNER_USER_ID,

          viewerUserId:
            VIEWER_USER_ID,

          allowPrivatePosts:
            true,

          limit:
            10,

          cursor:
            null,
        });

        expect(result.posts)
          .toHaveLength(1);
      },
    );

    test(
      "hides a public profile from a blocked viewer",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                false,
            }),
          );

        connectionsRepositoryMock
          .getRelationshipContext
          .mockResolvedValue({
            is_connected:
              false,

            is_blocked:
              true,
          });

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).not.toHaveBeenCalled();

        expect(result.posts)
          .toEqual([]);
      },
    );

    test(
      "gives blocking priority over a stale connection",
      async () => {
        profilesRepositoryMock
          .findByUsername
          .mockResolvedValue(
            createProfile({
              is_private:
                true,
            }),
          );

        connectionsRepositoryMock
          .getRelationshipContext
          .mockResolvedValue({
            is_connected:
              true,

            is_blocked:
              true,
          });

        const result =
          await PostService
            .getUserPosts({
              username:
                "user_94567b08",

              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          postsRepositoryMock
            .getUserPosts,
        ).not.toHaveBeenCalled();

        expect(result.posts)
          .toEqual([]);
      },
    );
  },
);
