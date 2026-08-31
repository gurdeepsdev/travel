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

  const STORED_KEY =
  "memories/63aae149-8f8f-4b30-b30d-211da764c080/2026/08/memory.png";

const transactionClient = {
  query:
    jest.fn(),
};

const databaseMock = {
  transaction:
    jest.fn(),
};

const storageManagerMock = {
  store:
    jest.fn(),

  remove:
    jest.fn(),
};

const mediaRepositoryMock = {
  resolveUploadedAssets:
    jest.fn(),
};

const inspectMemoryMediaFileMock =
  jest.fn();

const enqueueVideoAssetsMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/media/video-processing.queue.js",
  () => ({
    enqueueVideoAssets:
      enqueueVideoAssetsMock,
  }),
);

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

jest.unstable_mockModule(
  "../../../src/database/database-manager.js",
  () => ({
    default:
      databaseMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/providers/storage/storage-manager.js",
  () => ({
    default:
      storageManagerMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/media/media.repository.js",
  () => ({
    default:
      mediaRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/utils/memory-media-file.util.js",
  () => ({
    inspectMemoryMediaFile:
      inspectMemoryMediaFileMock,
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

    enqueueVideoAssetsMock
      .mockResolvedValue();

    databaseMock
      .transaction
      .mockImplementation(
        async (callback) =>
          callback(
            transactionClient,
          ),
      );

    inspectMemoryMediaFileMock
      .mockResolvedValue({
        temporaryPath:
          "/tmp/memory-upload",

        originalFilename:
          "memory.png",

        mimeType:
          "image/png",

        extension:
          "png",

        fileSize:
          445,

        checksum:
          "5b0cfd52dc0bfbe544f4e1a9c77aa46b8629b0e0aad6c54f95eef457b86c2a89",

        mediaType:
          "IMAGE",
      });

    storageManagerMock
      .store
      .mockResolvedValue({
        storageProvider:
          "local",

        bucket:
          "local",

        storageKey:
          STORED_KEY,
      });

    storageManagerMock
      .remove
      .mockResolvedValue();

    mediaRepositoryMock
      .resolveUploadedAssets
      .mockResolvedValue({
        assets: [
          {
            id:
              ASSET_ID,

            fileIndex:
              0,
          },
        ],

        unusedStoredObjects:
          [],

        supersededStoredObjects:
          [],
      });
  });

  describe("saveMemory", () => {

        test(
      "rejects a request without an asset or upload",
      async () => {
        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              memoryType:
                "IMAGE",
            }),
        ).rejects.toMatchObject({
          code:
            "MEMORY.MEDIA_REQUIRED",

          statusCode:
            400,
        });

        expect(
          repositoryMock.save,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects assetId and upload together",
      async () => {
        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              assetId:
                ASSET_ID,

              memoryType:
                "IMAGE",

              memoryFile: {
                path:
                  "/tmp/memory-upload",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "COMMON.VALIDATION_FAILED",

          statusCode:
            400,
        });

        expect(
          inspectMemoryMediaFileMock,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a memory type that does not match the upload",
      async () => {
        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              memoryType:
                "VIDEO",

              memoryFile: {
                path:
                  "/tmp/memory-upload",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "MEMORY.MEDIA_INVALID_TYPE",

          statusCode:
            415,
        });

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "uploads and saves a private image memory transactionally",
      async () => {
        const memoryFile = {
          path:
            "/tmp/memory-upload",

          originalname:
            "memory.png",

          mimetype:
            "image/png",
        };

        repositoryMock.save
          .mockResolvedValue(
            createMemoryRow(),
          );

        const result =
          await MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              memoryType:
                "IMAGE",

              memoryFile,
            });

        expect(
          inspectMemoryMediaFileMock,
        ).toHaveBeenCalledWith(
          memoryFile,
        );

        expect(
          storageManagerMock.store,
        ).toHaveBeenCalledWith({
          temporaryPath:
            "/tmp/memory-upload",

          category:
            "memories",

          userId:
            USER_ID,

          extension:
            "png",
        });

        expect(
          mediaRepositoryMock
            .resolveUploadedAssets,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          userId:
            USER_ID,

          isPublic:
            false,

          uploads: [
            expect.objectContaining({
              storageKey:
                STORED_KEY,

              fileIndex:
                0,
            }),
          ],
        });

        expect(
          repositoryMock.save,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          userId:
            USER_ID,

          assetId:
            ASSET_ID,

          memoryType:
            "IMAGE",
        });

        expect(
          storageManagerMock.remove,
        ).not.toHaveBeenCalled();

        expect(result).toMatchObject({
          memory: {
            id:
              MEMORY_ID,

            memoryType:
              "IMAGE",

            asset: {
              id:
                ASSET_ID,
            },
          },
        });
      },
    );

    test(
      "removes stored media when the transaction fails",
      async () => {
        databaseMock
          .transaction
          .mockRejectedValue(
            new Error(
              "Transaction failed",
            ),
          );

        await expect(
          MemoriesService
            .saveMemory({
              userId:
                USER_ID,

              memoryType:
                "IMAGE",

              memoryFile: {
                path:
                  "/tmp/memory-upload",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "MEMORY.MEDIA_UPLOAD_FAILED",

          statusCode:
            500,
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORED_KEY,
        });
      },
    );
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

            processingStatus:
              "READY",

            thumbnailUrl:
              null,

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
      "returns the authenticated delivery URL for a private local memory",
      async () => {
        const previousBaseUrl =
          process.env
            .API_PUBLIC_BASE_URL;

        process.env
          .API_PUBLIC_BASE_URL =
            "https://apitest.artictern.com";

        repositoryMock.listMine
          .mockResolvedValue({
            rows: [
              createMemoryRow({
                storage_provider:
                  "local",

                storage_key:
                  STORED_KEY,
              }),
            ],

            hasMore:
              false,

            lastRow:
              null,
          });

        try {
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
            result.memories[0]
              .asset.url,
          ).toBe(
            `https://apitest.artictern.com/api/v1/media/assets/${ASSET_ID}/content`,
          );
        } finally {
          if (
            previousBaseUrl ===
            undefined
          ) {
            delete process.env
              .API_PUBLIC_BASE_URL;
          } else {
            process.env
              .API_PUBLIC_BASE_URL =
                previousBaseUrl;
          }
        }
      },
    );

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
