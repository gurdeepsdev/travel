import {
  jest,
} from "@jest/globals";

const repositoryMock = {
  findStorageSyncAsset:
    jest.fn(),
  markStorageProvider:
    jest.fn(),
};

const providerMock = {
  enabled: true,
  name: "r2",
  publishTranscode:
    jest.fn(),
  removeMany:
    jest.fn(),
  removeTranscode:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/media/video-processing.repository.js",
  () => ({
    default: repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/providers/storage/video-object-storage.provider.js",
  () => ({
    default: providerMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/providers/storage/local.provider.js",
  () => ({
    resolveStoragePath: (key) =>
      `/uploads/${key}`,
  }),
);

const {
  default: service,
} = await import(
  "../../../src/modules/media/video-storage-sync.service.js"
);

const createAsset = (
  overrides = {},
) => ({
  id:
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  storage_provider: "local",
  storage_key:
    "posts/user/video.mp4",
  thumbnail_storage_key:
    "posts/user/video.thumbnail.jpg",
  hls_manifest_storage_key:
    "posts/user/video.hls/master.m3u8",
  mime_type: "video/mp4",
  processing_status: "READY",
  is_public: true,
  ...overrides,
});

describe(
  "VideoStorageSyncService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      providerMock.enabled = true;
    });

    test(
      "publishes a public local video and changes provider after upload",
      async () => {
        repositoryMock
          .findStorageSyncAsset
          .mockResolvedValue(
            createAsset(),
          );
        providerMock
          .publishTranscode
          .mockResolvedValue({
            storageProvider: "r2",
            bucket:
              "artictern-uat-video",
            uploadedKeys: [
              "posts/user/video.mp4",
            ],
          });
        repositoryMock
          .markStorageProvider
          .mockResolvedValue(true);

        await expect(
          service.sync(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ),
        ).resolves.toEqual({
          skipped: false,
          action: "PUBLISHED",
        });

        expect(
          repositoryMock
            .markStorageProvider,
        ).toHaveBeenCalledWith({
          assetId:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          expectedIsPublic: true,
          expectedStorageProvider:
            "local",
          storageProvider: "r2",
          bucket:
            "artictern-uat-video",
        });
      },
    );

    test(
      "removes a stale upload when visibility changed during publication",
      async () => {
        repositoryMock
          .findStorageSyncAsset
          .mockResolvedValue(
            createAsset(),
          );
        providerMock
          .publishTranscode
          .mockResolvedValue({
            storageProvider: "r2",
            bucket:
              "artictern-uat-video",
            uploadedKeys: ["one", "two"],
          });
        repositoryMock
          .markStorageProvider
          .mockResolvedValue(false);

        await expect(
          service.sync(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ),
        ).resolves.toMatchObject({
          action: "STALE",
        });

        expect(providerMock.removeMany)
          .toHaveBeenCalledWith([
            "one",
            "two",
          ]);
      },
    );

    test(
      "withdraws a private R2 video before restoring local delivery",
      async () => {
        const asset = createAsset({
          storage_provider: "r2",
          is_public: false,
        });
        repositoryMock
          .findStorageSyncAsset
          .mockResolvedValue(asset);
        repositoryMock
          .markStorageProvider
          .mockResolvedValue(true);

        await expect(
          service.sync(asset.id),
        ).resolves.toEqual({
          skipped: false,
          action: "WITHDRAWN",
        });

        expect(
          providerMock.removeTranscode,
        ).toHaveBeenCalled();
        expect(
          repositoryMock
            .markStorageProvider,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            expectedIsPublic: false,
            expectedStorageProvider: "r2",
            storageProvider: "local",
          }),
        );
      },
    );
  },
);
