import {
  jest,
} from "@jest/globals";

const OWNER_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const VIEWER_USER_ID =
  "a4bfc312-1065-4377-adf7-98792cd212a3";

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