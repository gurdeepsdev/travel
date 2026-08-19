import {
  jest,
} from "@jest/globals";

import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const BLOCKED_USER_ID =
  "b3fe5214-e569-4300-8509-589785ad86f2";

const BLOCK_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const repositoryMock = {
  blockUser:
    jest.fn(),

  unblockUser:
    jest.fn(),

  listBlockedUsers:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/blocks.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

const { default: BlocksService } =
  await import(
    "../../../src/modules/users/services/blocks.service.js"
  );

function createBlockRow(
  overrides = {},
) {
  return {
    id:
      BLOCK_ID,

    user_id:
      USER_ID,

    blocked_user_id:
      BLOCKED_USER_ID,

    created_at:
      new Date(
        "2026-08-19T10:00:00.000Z",
      ),

    cursor_created_at:
      "2026-08-19T10:00:00.000Z",

    blocked_username:
      "blocked_user",

    blocked_display_name:
      "Blocked User",

    blocked_is_verified:
      false,

    blocked_is_private:
      false,

    blocked_profile_photo_id:
      null,

    blocked_profile_photo_storage_provider:
      null,

    blocked_profile_photo_bucket:
      null,

    blocked_profile_photo_storage_key:
      null,

    blocked_profile_photo_mime_type:
      null,

    blocked_profile_photo_is_public:
      false,

    connection_removed:
      true,

    requests_cancelled:
      2,

    ...overrides,
  };
}

describe(
  "BlocksService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe(
      "blockUser",
      () => {
        test(
          "blocks another active user",
          async () => {
            repositoryMock
              .blockUser
              .mockResolvedValue(
                createBlockRow(),
              );

            const result =
              await BlocksService
                .blockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    BLOCKED_USER_ID,
                });

            expect(
              repositoryMock
                .blockUser,
            ).toHaveBeenCalledWith({
              userId:
                USER_ID,

              blockedUserId:
                BLOCKED_USER_ID,
            });

            expect(
              result,
            ).toEqual({
              blocked:
                true,

              block: {
                id:
                  BLOCK_ID,

                createdAt:
                  new Date(
                    "2026-08-19T10:00:00.000Z",
                  ),

                user: {
                  id:
                    BLOCKED_USER_ID,

                  username:
                    "blocked_user",

                  displayName:
                    "Blocked User",

                  isVerified:
                    false,

                  isPrivate:
                    false,

                  profilePhoto:
                    null,
                },
              },

              connectionRemoved:
                true,

              connectionRequestsCancelled:
                2,
            });
          },
        );

        test(
          "rejects blocking yourself before querying",
          async () => {
            await expect(
              BlocksService
                .blockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "BLOCK.SELF_BLOCK_NOT_ALLOWED",

              statusCode:
                400,
            });

            expect(
              repositoryMock
                .blockUser,
            ).not.toHaveBeenCalled();
          },
        );

        test(
          "hides a missing or inactive target",
          async () => {
            repositoryMock
              .blockUser
              .mockResolvedValue(
                null,
              );

            await expect(
              BlocksService
                .blockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    BLOCKED_USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "BLOCK.TARGET_NOT_AVAILABLE",

              statusCode:
                404,
            });
          },
        );
      },
    );

    describe(
      "unblockUser",
      () => {
        test(
          "unblocks another user",
          async () => {
            repositoryMock
              .unblockUser
              .mockResolvedValue(
                createBlockRow(),
              );

            const result =
              await BlocksService
                .unblockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    BLOCKED_USER_ID,
                });

            expect(
              result,
            ).toEqual({
              unblocked:
                true,

              userId:
                BLOCKED_USER_ID,
            });
          },
        );

        test(
          "returns an idempotent response when no block exists",
          async () => {
            repositoryMock
              .unblockUser
              .mockResolvedValue(
                null,
              );

            const result =
              await BlocksService
                .unblockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    BLOCKED_USER_ID,
                });

            expect(
              result,
            ).toEqual({
              unblocked:
                false,

              userId:
                BLOCKED_USER_ID,
            });
          },
        );

        test(
          "rejects unblocking yourself before querying",
          async () => {
            await expect(
              BlocksService
                .unblockUser({
                  userId:
                    USER_ID,

                  blockedUserId:
                    USER_ID,
                }),
            ).rejects.toMatchObject({
              code:
                "BLOCK.SELF_BLOCK_NOT_ALLOWED",

              statusCode:
                400,
            });

            expect(
              repositoryMock
                .unblockUser,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );

    describe(
      "getBlockedUsers",
      () => {
        test(
          "returns blocked users with an opaque next cursor",
          async () => {
            const row =
              createBlockRow();

            repositoryMock
              .listBlockedUsers
              .mockResolvedValue({
                rows: [
                  row,
                ],

                hasMore:
                  true,

                lastRow:
                  row,
              });

            const result =
              await BlocksService
                .getBlockedUsers({
                  userId:
                    USER_ID,

                  limit:
                    1,

                  cursor:
                    null,
                });

            expect(
              result.blockedUsers,
            ).toHaveLength(
              1,
            );

            expect(
              typeof result
                .pagination
                .nextCursor,
            ).toBe(
              "string",
            );

            expect(
              decodeCursor(
                result.pagination
                  .nextCursor,
              ),
            ).toEqual({
              createdAt:
                "2026-08-19T10:00:00.000Z",

              id:
                BLOCK_ID,
            });
          },
        );

        test(
          "rejects an invalid cursor before querying",
          async () => {
            await expect(
              BlocksService
                .getBlockedUsers({
                  userId:
                    USER_ID,

                  limit:
                    20,

                  cursor:
                    "invalid",
                }),
            ).rejects.toMatchObject({
              code:
                "COMMON.INVALID_CURSOR",

              statusCode:
                400,
            });

            expect(
              repositoryMock
                .listBlockedUsers,
            ).not.toHaveBeenCalled();
          },
        );
      },
    );
  },
);
