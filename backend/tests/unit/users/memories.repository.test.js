import {
  jest,
} from "@jest/globals";

const databaseQueryMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/database/database-manager.js",
  () => ({
    default: {
      query:
        databaseQueryMock,
    },
  }),
);

const {
  default: MemoriesRepository,
} = await import(
  "../../../src/modules/users/repositories/memories.repository.js"
);

describe("MemoriesRepository save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("uses the supplied transaction client", async () => {
    const client = {
      query:
        jest.fn()
          .mockResolvedValue({
            rows: [
              {
                id:
                  "97000000-0000-4000-8000-000000000001",
              },
            ],
          }),
    };

    await expect(
      MemoriesRepository.save({
        client,
        userId:
          "63aae149-8f8f-4b30-b30d-211da764c080",
        assetId:
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        memoryType:
          "IMAGE",
      }),
    ).resolves.toMatchObject({
      id:
        "97000000-0000-4000-8000-000000000001",
    });

    expect(client.query)
      .toHaveBeenCalledTimes(1);

    expect(databaseQueryMock)
      .not.toHaveBeenCalled();
  });
});
