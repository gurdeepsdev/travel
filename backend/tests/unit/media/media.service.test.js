import {
  jest,
} from "@jest/globals";

const ASSET_ID =
  "d6000000-0000-4000-8000-000000000001";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const repositoryMock = {
  findDeliveryContext:
    jest.fn(),

  findThumbnailDeliveryContext:
    jest.fn(),
};

const accessMock =
  jest.fn();

const resolveStoragePathMock =
  jest.fn();

jest.unstable_mockModule(
  "node:fs/promises",
  () => ({
    access:
      accessMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/media/media.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/providers/storage/local.provider.js",
  () => ({
    resolveStoragePath:
      resolveStoragePathMock,
  }),
);

const {
  default:
    MediaService,
} = await import(
  "../../../src/modules/media/media.service.js"
);

function createAsset(
  overrides = {},
) {
  return {
    id:
      ASSET_ID,

    uploaded_by:
      USER_ID,

    storage_provider:
      "local",

    bucket:
      "local",

    storage_key:
      "posts/user/photo.png",

    original_filename:
      "photo.png",

    mime_type:
      "image/png",

    extension:
      "png",

    file_size:
      "445",

    is_public:
      true,

    ...overrides,
  };
}

describe(
  "MediaService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      repositoryMock
        .findDeliveryContext
        .mockResolvedValue(
          createAsset(),
        );

      resolveStoragePathMock
        .mockReturnValue(
          "/absolute/uploads/posts/user/photo.png",
        );

      accessMock
        .mockResolvedValue(
          undefined,
        );

      repositoryMock
        .findThumbnailDeliveryContext
        .mockResolvedValue({
          ...createAsset(),
          storage_key:
            "posts/user/video.thumbnail.jpg",
        });
    });

    test(
      "returns readable public local content",
      async () => {
        const result =
          await MediaService
            .getLocalAssetContent({
              assetId:
                ASSET_ID,

              viewerUserId:
                null,
            });

        expect(
          repositoryMock
            .findDeliveryContext,
        ).toHaveBeenCalledWith({
          assetId:
            ASSET_ID,

          viewerUserId:
            null,
        });

        expect(result).toEqual({
          asset:
            createAsset(),

          filePath:
            "/absolute/uploads/posts/user/photo.png",

          cacheControl:
            "public, max-age=3600",
        });
      },
    );

    test(
      "returns private local content to an authorized owner",
      async () => {
        repositoryMock
          .findDeliveryContext
          .mockResolvedValue(
            createAsset({
              is_public:
                false,
            }),
          );

        const result =
          await MediaService
            .getLocalAssetContent({
              assetId:
                ASSET_ID,

              viewerUserId:
                USER_ID,
            });

        expect(
          repositoryMock
            .findDeliveryContext,
        ).toHaveBeenCalledWith({
          assetId:
            ASSET_ID,

          viewerUserId:
            USER_ID,
        });

        expect(
          result.cacheControl,
        ).toBe(
          "private, no-store",
        );
      },
    );

    test(
      "returns an authorized local video thumbnail",
      async () => {
        const result =
          await MediaService
            .getLocalAssetThumbnail({
              assetId:
                ASSET_ID,
              viewerUserId:
                USER_ID,
            });

        expect(
          repositoryMock
            .findThumbnailDeliveryContext,
        ).toHaveBeenCalledWith({
          assetId:
            ASSET_ID,
          viewerUserId:
            USER_ID,
        });

        expect(result).toMatchObject({
          filePath:
            "/absolute/uploads/posts/user/photo.png",
          cacheControl:
            "public, max-age=3600",
        });
      },
    );

    test(
      "hides a missing or unauthorized asset",
      async () => {
        repositoryMock
          .findDeliveryContext
          .mockResolvedValue(null);

        await expect(
          MediaService
            .getLocalAssetContent({
              assetId:
                ASSET_ID,

              viewerUserId:
                null,
            }),
        ).rejects.toMatchObject({
          code:
            "MEDIA.ASSET_NOT_FOUND",

          statusCode: 404,
        });

        expect(
          accessMock,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "does not deliver an R2 asset through the local endpoint",
      async () => {
        repositoryMock
          .findDeliveryContext
          .mockResolvedValue(
            createAsset({
              storage_provider:
                "r2",
            }),
          );

        await expect(
          MediaService
            .getLocalAssetContent({
              assetId:
                ASSET_ID,

              viewerUserId:
                null,
            }),
        ).rejects.toMatchObject({
          code:
            "MEDIA.ASSET_NOT_FOUND",

          statusCode: 404,
        });

        expect(
          resolveStoragePathMock,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "reports unavailable local content without exposing its path",
      async () => {
        accessMock
          .mockRejectedValue(
            Object.assign(
              new Error(
                "File missing.",
              ),
              {
                code:
                  "ENOENT",
              },
            ),
          );

        await expect(
          MediaService
            .getLocalAssetContent({
              assetId:
                ASSET_ID,

              viewerUserId:
                USER_ID,
            }),
        ).rejects.toMatchObject({
          code:
            "MEDIA.CONTENT_UNAVAILABLE",

          statusCode: 503,

          details: null,
        });
      },
    );
  },
);
