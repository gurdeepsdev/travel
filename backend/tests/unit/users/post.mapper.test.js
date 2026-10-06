import PostMapper
  from "../../../src/modules/users/mappers/post.mapper.js";

test('image variants are additive and private variants never expose CDN URLs', () => {
  const asset = { id: 'image', mimeType: 'image/jpeg', storageProvider: 'local', storageKey: 'posts/image.jpg',
    imageVariants: [{ name: 'medium', width: 640, height: 480, fileSize: 1000,
      storageProvider: 'r2', storageKey: 'posts/image.jpg.images-v1/medium.webp' }] };
  const result = PostMapper.mapAsset({ ...asset, isPublic: false });
  expect(result.url).toBe('/api/v1/media/assets/image/content');
  expect(result.imageVariants[0]).toEqual({ size: 640, width: 640, height: 480,
    fileSize: 1000, mimeType: 'image/webp', url: '/api/v1/media/assets/image/images/640' });
  const previous = process.env.VIDEO_CDN_PUBLIC_BASE_URL;
  process.env.VIDEO_CDN_PUBLIC_BASE_URL = 'https://media-uat.artictern.com';
  try {
    expect(PostMapper.mapAsset({ ...asset, isPublic: true }).imageVariants[0].url)
      .toBe('https://media-uat.artictern.com/posts/image.jpg.images-v1/medium.webp');
  } finally {
    if (previous === undefined) delete process.env.VIDEO_CDN_PUBLIC_BASE_URL;
    else process.env.VIDEO_CDN_PUBLIC_BASE_URL = previous;
  }
  expect(PostMapper.mapAsset({ ...asset, imageVariants: undefined }).imageVariants).toEqual([]);
});

test('1080p is advertised only when it was generated; legacy HLS URLs remain unchanged', () => {
  const asset = { id: 'video', mimeType: 'video/mp4', storageProvider: 'local', hlsManifestStorageKey: 'posts/video.hls/master.m3u8' };
  expect(PostMapper.mapAsset(asset).renditionUrls['1080p']).toBeUndefined();
  expect(PostMapper.mapAsset({ ...asset, hlsRenditions: ['360p','540p','720p','1080p'] }).renditionUrls['1080p'])
    .toBe('/api/v1/media/assets/video/stream/1080p/index.m3u8');
});

describe(
  "PostMapper",
  () => {
    test(
      "includes post and author share URLs",
      () => {
        const result =
          PostMapper.toResponse({
            id:
              "44444444-4444-4444-8444-444444444444",
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",
            username:
              "user_98ef01e9",
            assets:
              [],
            itineraries:
              [],
          });

        expect(
          result.author
            .shareprofile_url,
        ).toBe(
          "https://artictern.com/u/user_98ef01e9",
        );

        expect(
          result.sharepost_url,
        ).toBe(
          "https://artictern.com/p/44444444-4444-4444-8444-444444444444",
        );
      },
    );

    test(
      "includes complete itinerary JSON in a post itinerary",
      () => {
        const itineraryJson = {
          city_name:
            "Delhi",
          itinerary: [
            {
              day: 1,
              items: [
                {
                  name:
                    "India Gate",
                },
              ],
            },
          ],
        };

        const result =
          PostMapper.toResponse({
            id:
              "44444444-4444-4444-8444-444444444444",
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",
            assets: [],
            itineraries: [
              {
                id:
                  "55555555-5555-4555-8555-555555555555",
                itineraryJson,
              },
            ],
          });

        expect(
          result.itineraries[0]
            .itineraryJson,
        ).toEqual(itineraryJson);
      },
    );

    test(
      "includes startup and rendition URLs for a ready HLS asset",
      () => {
        process.env
          .VIDEO_CDN_PUBLIC_BASE_URL =
            "https://media.example.com";

        const result =
          PostMapper.toResponse({
            id:
              "44444444-4444-4444-8444-444444444444",
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",
            assets: [
              {
                id: "asset-id",
                mimeType: "video/mp4",
                processingStatus:
                  "READY",
                storageProvider: "r2",
                storageKey:
                  "posts/user/video.mp4",
                hlsManifestStorageKey:
                  "posts/user/video.hls/master.m3u8",
                isPublic: true,
              },
            ],
            itineraries: [],
          });

        expect(
          result.assets[0],
        ).toMatchObject({
          streamUrl:
            "https://media.example.com/posts/user/video.hls/master.m3u8",
          startupStreamUrl:
            "https://media.example.com/posts/user/video.hls/360p/index.m3u8",
          renditionUrls: {
            "360p":
              "https://media.example.com/posts/user/video.hls/360p/index.m3u8",
            "540p":
              "https://media.example.com/posts/user/video.hls/540p/index.m3u8",
            "720p":
              "https://media.example.com/posts/user/video.hls/720p/index.m3u8",
          },
        });
      },
    );
  },
);
