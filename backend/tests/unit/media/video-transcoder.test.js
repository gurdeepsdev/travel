import {
  createFfmpegArguments,
  createHlsArguments,
  createHlsManifestStorageKey,
  createMp4StorageKey,
  createThumbnailArguments,
  createThumbnailStorageKey,
} from "../../../src/modules/media/video-transcoder.js";

describe(
  "video transcoder",
  () => {
    test(
      "builds a compatible MP4 command",
      () => {
        const args =
          createFfmpegArguments({
            inputPath:
              "/uploads/input.mov",

            outputPath:
              "/uploads/output.tmp",
          });

        expect(args).toEqual(
          expect.arrayContaining([
            "libx264",
            "23",
            "2000k",
            "4000k",
            "yuv420p",
            "scale=w='min(iw,if(gt(iw,ih),1280,720))':h='min(ih,if(gt(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2",
            "aac",
            "128k",
            "+faststart",
            "mp4",
          ]),
        );

        expect(
          args[args.length - 1],
        ).toBe(
          "/uploads/output.tmp",
        );
      },
    );

    test(
      "builds a two-second VOD HLS rendition command",
      () => {
        const args = createHlsArguments({
          inputPath: "/uploads/video.mp4",
          playlistPath:
            "/uploads/video.hls/360p/index.m3u8",
          segmentPattern:
            "/uploads/video.hls/360p/segment_%06d.ts",
          rendition: {
            maxWidth: 640,
            maxHeight: 360,
            videoBitrate: "600k",
            maxRate: "660k",
            bufferSize: "1200k",
            audioBitrate: "96k",
          },
        });

        expect(args).toEqual(
          expect.arrayContaining([
            "600k",
            "660k",
            "expr:gte(t,n_forced*2)",
            "2",
            "vod",
            "independent_segments",
          ]),
        );
      },
    );

    test(
      "creates a sibling HLS manifest storage key",
      () => {
        expect(
          createHlsManifestStorageKey(
            "posts/user/clip.mp4",
          ),
        ).toBe(
          "posts/user/clip.hls/master.m3u8",
        );
      },
    );

    test(
      "normalizes any video storage key to MP4",
      () => {
        expect(
          createMp4StorageKey(
            "posts/user/clip.webm",
          ),
        ).toBe(
          "posts/user/clip.mp4",
        );
      },
    );

    test(
      "builds a bounded JPEG thumbnail command",
      () => {
        const args =
          createThumbnailArguments({
            inputPath:
              "/uploads/video.mp4",
            outputPath:
              "/uploads/video.thumbnail.jpg",
            durationSeconds: 120,
          });

        expect(args).toEqual(
          expect.arrayContaining([
            "5.000",
            "1",
            "scale='min(640,iw)':-2",
            "image2",
          ]),
        );
      },
    );

    test(
      "creates a sibling JPEG thumbnail storage key",
      () => {
        expect(
          createThumbnailStorageKey(
            "posts/user/clip.mp4",
          ),
        ).toBe(
          "posts/user/clip.thumbnail.jpg",
        );
      },
    );
  },
);
