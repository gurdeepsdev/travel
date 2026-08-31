import {
  jest,
} from "@jest/globals";

const addBulkMock =
  jest.fn();

jest.unstable_mockModule(
  "bullmq",
  () => ({
    Queue:
      jest.fn(() => ({
        addBulk:
          addBulkMock,
      })),
  }),
);

const {
  createVideoProcessingJobs,
  enqueueVideoAssets,
} = await import(
  "../../../src/modules/media/video-processing.queue.js"
);

describe(
  "video processing queue",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      addBulkMock.mockResolvedValue([]);
    });

    test(
      "queues only videos awaiting processing",
      async () => {
        const assets = [
          {
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",

            storage_key:
              "posts/user/video.mov",

            mime_type:
              "video/quicktime",

            processing_status:
              "PROCESSING",
          },
          {
            id:
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",

            storage_key:
              "posts/user/image.jpg",

            mime_type:
              "image/jpeg",

            processing_status:
              "READY",
          },
        ];

        const jobs =
          createVideoProcessingJobs(
            assets,
          );

        expect(jobs).toHaveLength(1);
        expect(jobs[0]).toMatchObject({
          name:
            "transcode-video",

          data: {
            assetId:
              assets[0].id,
          },
        });

        await enqueueVideoAssets(
          assets,
        );

        expect(
          addBulkMock,
        ).toHaveBeenCalledWith(
          jobs,
        );
      },
    );
  },
);
