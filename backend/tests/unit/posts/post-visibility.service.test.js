import {
  jest,
} from "@jest/globals";

const postsRepositoryMock = {
  updateVisibilityOwned:
    jest.fn(),
};

const enqueueVideoStorageSyncMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/posts.repository.js",
  () => ({
    default:
      postsRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/media/video-processing.queue.js",
  () => ({
    enqueueVideoStorageSync:
      enqueueVideoStorageSyncMock,
  }),
);

const { default: PostVisibilityService } =
  await import(
    "../../../src/modules/posts/services/post-visibility.service.js"
  );

const POST_ID =
  "550e8400-e29b-41d4-a716-446655440000";
const USER_ID =
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("PostVisibilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updates an owned post", async () => {
    const updatedAt =
      new Date("2026-09-03T10:00:00.000Z");

    postsRepositoryMock
      .updateVisibilityOwned
      .mockResolvedValue({
        id: POST_ID,
        visibility: "PRIVATE",
        updated_at: updatedAt,
        storage_sync_assets: [
          {
            id: "asset-id",
            mime_type: "video/mp4",
            processing_status: "READY",
          },
        ],
      });

    await expect(
      PostVisibilityService
        .updateVisibility({
          postId: POST_ID,
          userId: USER_ID,
          visibility: "PRIVATE",
        }),
    ).resolves.toEqual({
      post: {
        id: POST_ID,
        visibility: "PRIVATE",
        updatedAt,
      },
    });

    expect(
      enqueueVideoStorageSyncMock,
    ).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "asset-id",
      }),
    ]);
  });

  test("returns not found for a missing or unowned post", async () => {
    postsRepositoryMock
      .updateVisibilityOwned
      .mockResolvedValue(null);

    await expect(
      PostVisibilityService
        .updateVisibility({
          postId: POST_ID,
          userId: USER_ID,
          visibility: "PUBLIC",
        }),
    ).rejects.toMatchObject({
      code: "POST.NOT_FOUND",
      statusCode: 404,
    });
  });
});
