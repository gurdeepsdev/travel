import {
  jest,
} from "@jest/globals";

const POST_ID =
  "44444444-4444-4444-8444-444444444444";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const DELETED_AT =
  new Date(
    "2026-08-20T10:00:00.000Z",
  );

const postsRepositoryMock = {
  softDeleteOwned:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/posts.repository.js",
  () => ({
    default:
      postsRepositoryMock,
  }),
);

const {
  default: PostDeleteService,
} = await import(
  "../../../src/modules/posts/services/post-delete.service.js"
);

describe(
  "PostDeleteService",
  () => {
    beforeEach(
      () => {
        jest.clearAllMocks();
      },
    );

    test(
      "soft-deletes a post owned by the authenticated user",
      async () => {
        postsRepositoryMock
          .softDeleteOwned
          .mockResolvedValue({
            id:
              POST_ID,

            user_id:
              USER_ID,

            deleted_at:
              DELETED_AT,
          });

        const result =
          await PostDeleteService
            .deletePost({
              postId:
                POST_ID,

              userId:
                USER_ID,
            });

        expect(
          postsRepositoryMock
            .softDeleteOwned,
        ).toHaveBeenCalledWith({
          postId:
            POST_ID,

          userId:
            USER_ID,
        });

        expect(result).toEqual({
          deleted: true,

          post: {
            id:
              POST_ID,

            deletedAt:
              DELETED_AT,
          },
        });
      },
    );

    test(
      "hides missing, deleted, or unowned posts",
      async () => {
        postsRepositoryMock
          .softDeleteOwned
          .mockResolvedValue(
            null,
          );

        await expect(
          PostDeleteService
            .deletePost({
              postId:
                POST_ID,

              userId:
                USER_ID,
            }),
        ).rejects.toMatchObject({
          code:
            "POST.NOT_FOUND",

          message:
            "Post not found.",

          statusCode:
            404,
        });
      },
    );
  },
);
