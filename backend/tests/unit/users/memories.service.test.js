import { jest } from "@jest/globals";

import {
  decodeCursor,
} from "../../../src/shared/utils/cursor.js";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const ASSET_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const MEMORY_ID =
  "97000000-0000-4000-8000-000000000001";

const repositoryMock = {
  save: jest.fn(),
  listMine: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/memories.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

const { default: MemoriesService } =
  await import(
    "../../../src/modules/users/services/memories.service.js"
  );

function createMemoryRow(
  overrides = {},
) {
  return {
    id:
      MEMORY_ID,

    user_id:
      USER_ID,

    asset_id:
      ASSET_ID,

    memory_type:
      "IMAGE",

    created_at:
      new Date(
        "2026-08-04T11:00:00Z",
      ),

    cursor_created_at:
      "2026-08-04 11:00:00.123456",

    storage_provider:
      "r2",

    bucket:
      "artictern-media",

    storage_key:
      "private/memories/photo.jpg",

    original_filename:
      "photo.jpg",

    mime_type:
      "image/jpeg",

    extension:
      "jpg",

    file_size:
      "245760",

    original_width:
      1200,

    original_height:
      800,

    duration_seconds:
      null,

    is_public:
      false,

    asset_created_at:
      new Date(
        "2026-08-04T10:59:00Z",
      ),

    ...overrides,
  };
}

describe("MemoriesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("saveMemory", () => {
    test(
      "saves an owned compatible asset",
      async () => {
        repositoryMock.save
          .mockResolvedValue(
            createMemoryRow(),
          );

        const result =
          await MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "IMAGE",
            });

        expect(
          repositoryMock.save,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          assetId:
            ASSET_ID,

          memoryType:
            "IMAGE",
        });

        expect(result).toEqual({
          memory: {
            id:
              MEMORY_ID,

            memoryType:
              "IMAGE",

            createdAt:
              new Date(
                "2026-08-04T11:00:00Z",
              ),

            asset: {
              id:
                ASSET_ID,

              originalFilename:
                "photo.jpg",

              mimeType:
                "image/jpeg",

              extension:
                "jpg",

              fileSize:
                245760,

              width:
                1200,

              height:
                800,

              durationSeconds:
                null,

              isPublic:
                false,

              url:
                null,

              createdAt:
                new Date(
                  "2026-08-04T10:59:00Z",
                ),
            },
          },
        });
      },
    );

    test(
      "returns the same memory for a repeated save",
      async () => {
        const memoryRow =
          createMemoryRow();

        repositoryMock.save
          .mockResolvedValue(
            memoryRow,
          );

        const firstResult =
          await MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "IMAGE",
            });

        const secondResult =
          await MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "IMAGE",
            });

        expect(
          repositoryMock.save,
        ).toHaveBeenCalledTimes(2);

        expect(secondResult)
          .toEqual(firstResult);
      },
    );

    test(
      "hides a missing, unowned, or incompatible asset",
      async () => {
        repositoryMock.save
          .mockResolvedValue(null);

        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "VIDEO",
            }),
        ).rejects.toMatchObject({
          code:
            "MEMORY.ASSET_NOT_ALLOWED",

          statusCode:
            404,
        });
      },
    );

    test(
      "maps a foreign-key race to asset not allowed",
      async () => {
        repositoryMock.save
          .mockRejectedValue(
            Object.assign(
              new Error(
                "Foreign key violation",
              ),
              {
                code:
                  "23503",
              },
            ),
          );

        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "IMAGE",
            }),
        ).rejects.toMatchObject({
          code:
            "MEMORY.ASSET_NOT_ALLOWED",

          statusCode:
            404,
        });
      },
    );
  });

  describe("getMyMemories", () => {
    test(
      "returns only the authenticated user's memories",
      async () => {
        repositoryMock.listMine
          .mockResolvedValue({
            rows: [
              createMemoryRow(),
            ],

            hasMore:
              false,

            lastRow:
              null,
          });

        const result =
          await MemoriesService
            .getMyMemories({
              userId:
                USER_ID,

              limit:
                20,

              cursor:
                null,
            });

        expect(
          repositoryMock.listMine,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          limit:
            20,

          cursor:
            null,
        });

        expect(result).toMatchObject({
          memories: [
            {
              id:
                MEMORY_ID,

              memoryType:
                "IMAGE",

              asset: {
                id:
                  ASSET_ID,

                mimeType:
                  "image/jpeg",

                isPublic:
                  false,

                url:
                  null,
              },
            },
          ],

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
      "creates a timestamp-safe next cursor",
      async () => {
        const lastRow =
          createMemoryRow();

        repositoryMock.listMine
          .mockResolvedValue({
            rows: [
              lastRow,
            ],

            hasMore:
              true,

            lastRow,
          });

        const result =
          await MemoriesService
            .getMyMemories({
              userId:
                USER_ID,

              limit:
                1,

              cursor:
                null,
            });

        expect(
          result.pagination.hasMore,
        ).toBe(true);

        expect(
          decodeCursor(
            result.pagination
              .nextCursor,
          ),
        ).toEqual({
          createdAt:
            lastRow
              .cursor_created_at,

          id:
            lastRow.id,
        });
      },
    );

    test(
      "rejects a malformed cursor before querying",
      async () => {
        await expect(
          MemoriesService
            .getMyMemories({
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
          repositoryMock.listMine,
        ).not.toHaveBeenCalled();
      },
    );
  });
});