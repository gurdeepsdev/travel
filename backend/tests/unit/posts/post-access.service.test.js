import {
  jest,
} from "@jest/globals";

const postsRepositoryMock = {
  findAccessContext:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/posts.repository.js",
  () => ({
    default:
      postsRepositoryMock,
  }),
);

const { default: PostAccessService } =
  await import(
    "../../../src/modules/posts/services/post-access.service.js"
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
    has_block_relationship: false,
    is_connected: false,
    ...overrides,
  };
}

describe("PostAccessService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows a stored public post regardless of current profile privacy", async () => {
    postsRepositoryMock
      .findAccessContext
      .mockResolvedValue(
        createPost(),
      );

    await expect(
      PostAccessService
        .assertCanInteract({
          postId: POST_ID,
          userId: VIEWER_ID,
        }),
    ).resolves.toMatchObject({
      id: POST_ID,
    });
  });

  test("allows an accepted connection to access a private post", async () => {
    postsRepositoryMock
      .findAccessContext
      .mockResolvedValue(
        createPost({
          visibility: "PRIVATE",
          is_connected: true,
        }),
      );

    await expect(
      PostAccessService
        .assertCanInteract({
          postId: POST_ID,
          userId: VIEWER_ID,
        }),
    ).resolves.toMatchObject({
      id: POST_ID,
    });
  });

  test("hides a private post from an unconnected viewer", async () => {
    postsRepositoryMock
      .findAccessContext
      .mockResolvedValue(
        createPost({
          visibility: "PRIVATE",
        }),
      );

    await expect(
      PostAccessService
        .assertCanInteract({
          postId: POST_ID,
          userId: VIEWER_ID,
        }),
    ).rejects.toMatchObject({
      code: "POST.NOT_FOUND",
      statusCode: 404,
    });
  });

  test("hides a post across a block relationship", async () => {
    postsRepositoryMock
      .findAccessContext
      .mockResolvedValue(
        createPost({
          has_block_relationship:
            true,
          is_connected:
            true,
        }),
      );

    await expect(
      PostAccessService
        .assertCanInteract({
          postId: POST_ID,
          userId: VIEWER_ID,
        }),
    ).rejects.toMatchObject({
      code: "POST.NOT_FOUND",
      statusCode: 404,
    });
  });
});
