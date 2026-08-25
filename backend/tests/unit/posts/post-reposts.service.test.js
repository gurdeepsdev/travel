import {
  jest,
} from "@jest/globals";

const ORIGINAL_POST_ID =
  "11111111-1111-4111-8111-111111111111";

const REPOST_POST_ID =
  "22222222-2222-4222-8222-222222222222";

const REQUESTED_POST_ID =
  "33333333-3333-4333-8333-333333333333";

const USER_ID =
  "44444444-4444-4444-8444-444444444444";

const ORIGINAL_OWNER_ID =
  "55555555-5555-4555-8555-555555555555";

const repostsRepositoryMock = {
  resolveOriginalPostId:
    jest.fn(),
  set:
    jest.fn(),
  remove:
    jest.fn(),
};

const accessServiceMock = {
  assertCanInteract:
    jest.fn(),
  createNotFoundError:
    jest.fn(),
};

const userPostsRepositoryMock = {
  getPostsByIds:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-reposts.repository.js",
  () => ({
    default:
      repostsRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-access.service.js",
  () => ({
    default:
      accessServiceMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/posts.repository.js",
  () => ({
    default:
      userPostsRepositoryMock,
  }),
);

const {
  default: PostRepostsService,
} = await import(
  "../../../src/modules/posts/services/post-reposts.service.js"
);

function createNotFoundError() {
  return Object.assign(
    new Error("Post not found."),
    {
      code:
        "POST.NOT_FOUND",
      statusCode:
        404,
    },
  );
}

describe(
  "PostRepostsService",
  () => {
    beforeEach(
      () => {
        jest.clearAllMocks();

        accessServiceMock
          .createNotFoundError
          .mockImplementation(
            createNotFoundError,
          );

        accessServiceMock
          .assertCanInteract
          .mockResolvedValue({
            id:
              ORIGINAL_POST_ID,
            user_id:
              ORIGINAL_OWNER_ID,
          });

        repostsRepositoryMock
          .resolveOriginalPostId
          .mockResolvedValue(
            ORIGINAL_POST_ID,
          );
      },
    );

    test(
      "creates a repost and returns its canonical post",
      async () => {
        const canonicalPost = {
          id:
            REPOST_POST_ID,
          repost: {
            originalPostId:
              ORIGINAL_POST_ID,
            message:
              "Worth visiting",
          },
        };

        repostsRepositoryMock
          .set
          .mockResolvedValue({
            postId:
              REPOST_POST_ID,
            created:
              true,
          });

        userPostsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            canonicalPost,
          ]);

        const result =
          await PostRepostsService
            .setRepost({
              postId:
                REQUESTED_POST_ID,
              userId:
                USER_ID,
              message:
                "Worth visiting",
            });

        expect(
          repostsRepositoryMock.set,
        ).toHaveBeenCalledWith({
          originalPostId:
            ORIGINAL_POST_ID,
          userId:
            USER_ID,
          message:
            "Worth visiting",
        });

        expect(
          userPostsRepositoryMock
            .getPostsByIds,
        ).toHaveBeenCalledWith({
          postIds: [
            REPOST_POST_ID,
          ],
          viewerUserId:
            USER_ID,
        });

        expect(result).toEqual({
          reposted:
            true,
          originalPostId:
            ORIGINAL_POST_ID,
          post:
            canonicalPost,
        });
      },
    );

    test(
      "resolves a repost target to its original post",
      async () => {
        repostsRepositoryMock
          .set
          .mockResolvedValue({
            postId:
              REPOST_POST_ID,
            created:
              false,
          });

        userPostsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            {
              id:
                REPOST_POST_ID,
            },
          ]);

        await PostRepostsService
          .setRepost({
            postId:
              REQUESTED_POST_ID,
            userId:
              USER_ID,
          });

        expect(
          accessServiceMock
            .assertCanInteract,
        ).toHaveBeenNthCalledWith(
          1,
          {
            postId:
              REQUESTED_POST_ID,
            userId:
              USER_ID,
          },
        );

        expect(
          accessServiceMock
            .assertCanInteract,
        ).toHaveBeenNthCalledWith(
          2,
          {
            postId:
              ORIGINAL_POST_ID,
            userId:
              USER_ID,
          },
        );
      },
    );

    test(
      "rejects reposting the viewer's own original post",
      async () => {
        accessServiceMock
          .assertCanInteract
          .mockResolvedValue({
            id:
              ORIGINAL_POST_ID,
            user_id:
              USER_ID,
          });

        await expect(
          PostRepostsService
            .setRepost({
              postId:
                ORIGINAL_POST_ID,
              userId:
                USER_ID,
            }),
        ).rejects.toMatchObject({
          code:
            "POST.REPOST_NOT_ALLOWED",
          statusCode:
            400,
        });

        expect(
          repostsRepositoryMock.set,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "hides a target that cannot be resolved",
      async () => {
        repostsRepositoryMock
          .resolveOriginalPostId
          .mockResolvedValue(
            null,
          );

        await expect(
          PostRepostsService
            .setRepost({
              postId:
                REQUESTED_POST_ID,
              userId:
                USER_ID,
            }),
        ).rejects.toMatchObject({
          code:
            "POST.NOT_FOUND",
          statusCode:
            404,
        });
      },
    );

    test(
      "removes the repost idempotently",
      async () => {
        repostsRepositoryMock
          .remove
          .mockResolvedValue(
            null,
          );

        const result =
          await PostRepostsService
            .removeRepost({
              postId:
                ORIGINAL_POST_ID,
              userId:
                USER_ID,
            });

        expect(
          repostsRepositoryMock.remove,
        ).toHaveBeenCalledWith({
          originalPostId:
            ORIGINAL_POST_ID,
          userId:
            USER_ID,
        });

        expect(result).toEqual({
          reposted:
            false,
          originalPostId:
            ORIGINAL_POST_ID,
          post:
            null,
        });
      },
    );
  },
);
