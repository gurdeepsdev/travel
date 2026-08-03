import { jest } from "@jest/globals";

const POST_ID =
  "44444444-4444-4444-8444-444444444444";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const SAVED_ITEM_ID =
  "2e5b2039-ca98-46a8-b931-c75cec123d21";

const repositoryMock = {
  save: jest.fn(),
  remove: jest.fn(),
  getState: jest.fn(),
};

const accessServiceMock = {
  assertCanInteract: jest.fn(),
  createNotFoundError: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-saves.repository.js",
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

const { default: PostSavesService } =
  await import(
    "../../../src/modules/posts/services/post-saves.service.js"
  );

function createSavedState(
  overrides = {},
) {
  return {
    id: SAVED_ITEM_ID,
    user_id: USER_ID,
    item_type: "POST",
    item_id: POST_ID,
    is_active: true,
    created_at:
      new Date("2026-08-03T10:00:00Z"),
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

describe("PostSavesService", () => {
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

  describe("savePost", () => {
    test(
      "saves a post and returns canonical state",
      async () => {
        repositoryMock.save
          .mockResolvedValue(
            createSavedState(),
          );

        repositoryMock.getState
          .mockResolvedValue(
            createSavedState(),
          );

        const result =
          await PostSavesService.savePost({
            postId: POST_ID,
            userId: USER_ID,
          });

        expect(
          accessServiceMock
            .assertCanInteract,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(
          repositoryMock.save,
        ).toHaveBeenCalledWith({
          postId: POST_ID,
          userId: USER_ID,
        });

        expect(result).toMatchObject({
          postId: POST_ID,
          viewerHasSaved: true,
          savedItem: {
            id: SAVED_ITEM_ID,
          },
        });
      },
    );

    test(
      "is idempotent when already saved",
      async () => {
        repositoryMock.save
          .mockResolvedValue(
            createSavedState(),
          );

        repositoryMock.getState
          .mockResolvedValue(
            createSavedState(),
          );

        const result =
          await PostSavesService.savePost({
            postId: POST_ID,
            userId: USER_ID,
          });

        expect(result.viewerHasSaved)
          .toBe(true);

        expect(result.savedItem.id)
          .toBe(SAVED_ITEM_ID);
      },
    );

    test(
      "maps a concurrently deleted post to not found",
      async () => {
        repositoryMock.save
          .mockResolvedValue(null);

        await expect(
          PostSavesService.savePost({
            postId: POST_ID,
            userId: USER_ID,
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.getState,
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
          PostSavesService.savePost({
            postId: POST_ID,
            userId: USER_ID,
          }),
        ).rejects.toMatchObject({
          code: "POST.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          repositoryMock.save,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("removeSavedPost", () => {
    test(
      "soft-removes a saved post",
      async () => {
        repositoryMock.remove
          .mockResolvedValue(
            createSavedState({
              is_active: false,
            }),
          );

        repositoryMock.getState
          .mockResolvedValue(
            createSavedState({
              is_active: false,
            }),
          );

        const result =
          await PostSavesService
            .removeSavedPost({
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
          viewerHasSaved: false,
          savedItem: null,
        });
      },
    );

    test(
      "is idempotent when no active save exists",
      async () => {
        repositoryMock.remove
          .mockResolvedValue(null);

        repositoryMock.getState
          .mockResolvedValue(null);

        const result =
          await PostSavesService
            .removeSavedPost({
              postId: POST_ID,
              userId: USER_ID,
            });

        expect(result).toEqual({
          postId: POST_ID,
          viewerHasSaved: false,
          savedItem: null,
        });
      },
    );
  });
});