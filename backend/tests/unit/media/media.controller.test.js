import {
  jest,
} from "@jest/globals";

const getLocalAssetStreamResourceMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/media/media.service.js",
  () => ({
    default: {
      getLocalAssetStreamResource:
        getLocalAssetStreamResourceMock,
    },
  }),
);

jest.unstable_mockModule(
  "../../../src/config/media-delivery.js",
  () => ({
    default: {
      xAccelEnabled: true,
      internalPrefix:
        "/_protected_media",
    },
  }),
);

const {
  default: MediaController,
} = await import(
  "../../../src/modules/media/media.controller.js"
);

describe(
  "MediaController accelerated delivery",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "authorizes an HLS resource before delegating bytes to nginx",
      async () => {
        getLocalAssetStreamResourceMock
          .mockResolvedValue({
            filePath:
              "/app/uploads/posts/user/video.hls/360p/segment_000000.ts",
            storageKey:
              "posts/user/video.hls/360p/segment_000000.ts",
            cacheControl:
              "public, max-age=31536000, immutable",
            contentType:
              "video/mp2t",
          });

        const req = {
          validated: {
            params: {
              assetId:
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              rendition:
                "360p",
              fileName:
                "segment_000000.ts",
            },
          },
          user: {
            id:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        };

        const res = {
          set: jest.fn(),
          status: jest.fn(),
          end: jest.fn(),
          sendFile: jest.fn(),
        };
        res.status.mockReturnValue(res);
        res.end.mockReturnValue(res);

        const next = jest.fn();

        await MediaController
          .getAssetStreamResource(
            req,
            res,
            next,
          );

        expect(
          getLocalAssetStreamResourceMock,
        ).toHaveBeenCalledWith({
          assetId:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          viewerUserId:
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          rendition:
            "360p",
          fileName:
            "segment_000000.ts",
        });

        expect(res.set)
          .toHaveBeenCalledWith(
            "X-Accel-Redirect",
            "/_protected_media/posts/user/video.hls/360p/segment_000000.ts",
          );
        expect(res.status)
          .toHaveBeenCalledWith(200);
        expect(res.end)
          .toHaveBeenCalled();
        expect(res.sendFile)
          .not.toHaveBeenCalled();
        expect(next)
          .not.toHaveBeenCalled();
      },
    );
  },
);
