import {
  jest,
} from "@jest/globals";

const repositoryMock = {
  findProcessableAsset:
    jest.fn(),

  markReady:
    jest.fn(),
};

const transcodeLocalVideoMock =
  jest.fn();

const finalizeTranscodeMock =
  jest.fn();

const rollbackTranscodeMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/media/video-processing.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/media/video-transcoder.js",
  () => ({
    transcodeLocalVideo:
      transcodeLocalVideoMock,

    finalizeTranscode:
      finalizeTranscodeMock,

    rollbackTranscode:
      rollbackTranscodeMock,
  }),
);

const { default: service } =
  await import(
    "../../../src/modules/media/video-processing.service.js"
  );

describe(
  "VideoProcessingService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "transcodes a local video and marks it ready",
      async () => {
        repositoryMock
          .findProcessableAsset
          .mockResolvedValue({
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

            storage_provider:
              "local",

            storage_key:
              "posts/user/video.mov",
          });

        transcodeLocalVideoMock
          .mockResolvedValue({
            outputStorageKey:
              "posts/user/video.mp4",

            outputPath:
              "/uploads/video.mp4",

            sourcePath:
              "/uploads/video.mov",

            backupPath:
              null,

            fileSize:
              1000,

            width:
              1280,

            height:
              720,

            durationSeconds:
              12,

            thumbnailPath:
              "/uploads/video.thumbnail.jpg",

            thumbnailStorageKey:
              "posts/user/video.thumbnail.jpg",

            thumbnailFileSize:
              25000,

            thumbnailWidth:
              640,

            thumbnailHeight:
              360,
          });

        repositoryMock
          .markReady
          .mockResolvedValue();

        await service.process(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        );

        expect(
          repositoryMock.markReady,
        ).toHaveBeenCalledWith({
          assetId:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",

          storageKey:
            "posts/user/video.mp4",

          fileSize:
            1000,

          width:
            1280,

          height:
            720,

          durationSeconds:
            12,

          thumbnailStorageKey:
            "posts/user/video.thumbnail.jpg",

          thumbnailFileSize:
            25000,

          thumbnailWidth:
            640,

          thumbnailHeight:
            360,
        });

        expect(
          finalizeTranscodeMock,
        ).toHaveBeenCalled();
      },
    );

    test(
      "skips an asset that is no longer processing",
      async () => {
        repositoryMock
          .findProcessableAsset
          .mockResolvedValue(null);

        await expect(
          service.process(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ),
        ).resolves.toEqual({
          skipped:
            true,
        });

        expect(
          transcodeLocalVideoMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
