import {
  createFfmpegArguments,
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
            "yuv420p",
            "aac",
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
