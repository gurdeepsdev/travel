import {
  jest,
} from "@jest/globals";

const saveMemoryMock =
  jest.fn();

const createdMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/users/services/memories.service.js",
  () => ({
    default: {
      saveMemory:
        saveMemoryMock,
    },
  }),
);

jest.unstable_mockModule(
  "../../../src/core/response/index.js",
  () => ({
    default: {
      created:
        createdMock,
    },
  }),
);

const {
  default: MemoriesController,
} = await import(
  "../../../src/modules/users/controllers/memories.controller.js"
);

describe("MemoriesController saveMemory", () => {
  test("forwards the uploaded file to the service", async () => {
    const memoryFile = {
      path:
        "/tmp/memory.png",
      mimetype:
        "image/png",
    };

    const logger = {
      error:
        jest.fn(),
    };

    const req = {
      user: {
        id:
          "63aae149-8f8f-4b30-b30d-211da764c080",
      },
      validated: {
        body: {
          memoryType:
            "IMAGE",
        },
      },
      file:
        memoryFile,
      logger,
    };

    const res = {};
    const next = jest.fn();

    saveMemoryMock
      .mockResolvedValue({
        memory: {
          id:
            "97000000-0000-4000-8000-000000000001",
        },
      });

    await MemoriesController
      .saveMemory(
        req,
        res,
        next,
      );

    expect(saveMemoryMock)
      .toHaveBeenCalledWith({
        userId:
          req.user.id,
        assetId:
          undefined,
        memoryType:
          "IMAGE",
        memoryFile,
        logger,
      });

    expect(next)
      .not.toHaveBeenCalled();
  });
});
