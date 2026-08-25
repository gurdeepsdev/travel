import {
  jest,
} from "@jest/globals";

const REPOST_ID =
  "11111111-1111-4111-8111-111111111111";

const ORIGINAL_POST_ID =
  "22222222-2222-4222-8222-222222222222";

const VIEWER_USER_ID =
  "33333333-3333-4333-8333-333333333333";

const databaseMock = {
  query:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/database/database-manager.js",
  () => ({
    default:
      databaseMock,
  }),
);

const {
  default: PostsRepository,
} = await import(
  "../../../src/modules/users/repositories/posts.repository.js"
);

function createRepostRow() {
  return {
    id:
      REPOST_ID,
    user_id:
      VIEWER_USER_ID,
    assets: [],
    itineraries: [],
    repost_id:
      "44444444-4444-4444-8444-444444444444",
    repost_message:
      "Worth sharing",
    repost_original_post_id:
      ORIGINAL_POST_ID,
  };
}

function createOriginalPostRow() {
  return {
    id:
      ORIGINAL_POST_ID,
    user_id:
      "55555555-5555-4555-8555-555555555555",
    caption:
      "Original caption",
    assets: [
      {
        id:
          "66666666-6666-4666-8666-666666666666",
        displayOrder:
          0,
        mimeType:
          "video/mp4",
        extension:
          "mp4",
      },
    ],
    itineraries: [],
  };
}

describe(
  "PostsRepository repost hydration",
  () => {
    beforeEach(
      () => {
        jest.clearAllMocks();
      },
    );

    test(
      "includes the original post caption and media",
      async () => {
        databaseMock.query
          .mockResolvedValueOnce({
            rows: [
              createRepostRow(),
            ],
          })
          .mockResolvedValueOnce({
            rows: [
              createOriginalPostRow(),
            ],
          });

        const posts =
          await PostsRepository
            .getPostsByIds({
              postIds: [
                REPOST_ID,
              ],
              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          posts[0].repost
            .originalPost.caption,
        ).toBe(
          "Original caption",
        );

        expect(
          posts[0].repost
            .originalPost.assets[0],
        ).toMatchObject({
          mediaType:
            "video",
          mimeType:
            "video/mp4",
          extension:
            "mp4",
        });
      },
    );

    test(
      "does not expose an inaccessible original post",
      async () => {
        databaseMock.query
          .mockResolvedValueOnce({
            rows: [
              createRepostRow(),
            ],
          })
          .mockResolvedValueOnce({
            rows: [],
          });

        const posts =
          await PostsRepository
            .getPostsByIds({
              postIds: [
                REPOST_ID,
              ],
              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          posts[0].repost
            .originalPost,
        ).toBeNull();
      },
    );
  },
);
