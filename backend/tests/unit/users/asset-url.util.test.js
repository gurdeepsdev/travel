import {
  buildAssetRenditionUrls,
  buildAssetStartupStreamUrl,
  buildAssetStreamUrl,
} from "../../../src/modules/users/utils/asset-url.util.js";

describe(
  "asset URL utility",
  () => {
    const originalBaseUrl =
      process.env
        .VIDEO_CDN_PUBLIC_BASE_URL;

    afterEach(() => {
      if (
        originalBaseUrl === undefined
      ) {
        delete process.env
          .VIDEO_CDN_PUBLIC_BASE_URL;
      } else {
        process.env
          .VIDEO_CDN_PUBLIC_BASE_URL =
            originalBaseUrl;
      }
    });

    test(
      "builds a CDN HLS URL for a public object-storage asset",
      () => {
        process.env
          .VIDEO_CDN_PUBLIC_BASE_URL =
            "https://media-uat.example.com/";

        expect(
          buildAssetStreamUrl({
            assetId: "asset-id",
            storageProvider: "r2",
            hlsManifestStorageKey:
              "posts/user/video.hls/master.m3u8",
            isPublic: true,
          }),
        ).toBe(
          "https://media-uat.example.com/posts/user/video.hls/master.m3u8",
        );
      },
    );

    test(
      "routes a private object-storage HLS asset through authenticated delivery",
      () => {
        process.env
          .VIDEO_CDN_PUBLIC_BASE_URL =
            "https://media-uat.example.com";

        expect(
          buildAssetStreamUrl({
            assetId: "asset-id",
            storageProvider: "r2",
            hlsManifestStorageKey:
              "posts/user/video.hls/master.m3u8",
            isPublic: false,
          }),
        ).toBe(
          "/api/v1/media/assets/asset-id/stream/master.m3u8",
        );
      },
    );

    test(
      "builds public CDN startup and rendition playlist URLs",
      () => {
        process.env
          .VIDEO_CDN_PUBLIC_BASE_URL =
            "https://media-uat.example.com";

        const input = {
          assetId: "asset-id",
          storageProvider: "r2",
          hlsManifestStorageKey:
            "posts/user/video.hls/master.m3u8",
          isPublic: true,
        };

        expect(
          buildAssetStartupStreamUrl(
            input,
          ),
        ).toBe(
          "https://media-uat.example.com/posts/user/video.hls/360p/index.m3u8",
        );
        expect(
          buildAssetRenditionUrls(
            input,
          ),
        ).toEqual({
          "360p":
            "https://media-uat.example.com/posts/user/video.hls/360p/index.m3u8",
          "540p":
            "https://media-uat.example.com/posts/user/video.hls/540p/index.m3u8",
          "720p":
            "https://media-uat.example.com/posts/user/video.hls/720p/index.m3u8",
        });
      },
    );

    test(
      "routes private rendition playlists through authenticated delivery",
      () => {
        expect(
          buildAssetStartupStreamUrl({
            assetId: "asset-id",
            storageProvider: "r2",
            hlsManifestStorageKey:
              "posts/user/video.hls/master.m3u8",
            isPublic: false,
          }),
        ).toBe(
          "/api/v1/media/assets/asset-id/stream/360p/index.m3u8",
        );
      },
    );
  },
);
