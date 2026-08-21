import {
  jest,
} from "@jest/globals";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const SAVED_ITEM_ID =
  "2e5b2039-ca98-46a8-b931-c75cec123d21";

const repositoryMock = {
  findActiveCity:
    jest.fn(),
  save:
    jest.fn(),
  remove:
    jest.fn(),
  getState:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/explore/repositories/city-saves.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

const {
  default: CitySavesService,
} = await import(
  "../../../src/modules/explore/services/city-saves.service.js"
);

const createSavedState = (
  overrides = {},
) => ({
  id:
    SAVED_ITEM_ID,
  user_id:
    USER_ID,
  item_type:
    "CITY",
  item_id:
    CITY_ID,
  is_active:
    true,
  created_at:
    new Date(
      "2026-08-21T12:00:00.000Z",
    ),
  ...overrides,
});

describe(
  "CitySavesService",
  () => {
    beforeEach(
      () => {
        jest.clearAllMocks();

        repositoryMock
          .findActiveCity
          .mockResolvedValue({
            id:
              CITY_ID,
          });
      },
    );

    test(
      "saves an active city",
      async () => {
        repositoryMock.save
          .mockResolvedValue(
            createSavedState(),
          );

        repositoryMock.getState
          .mockResolvedValue(
            createSavedState(),
          );

        const result =
          await CitySavesService
            .saveCity({
              cityId:
                CITY_ID,
              userId:
                USER_ID,
            });

        expect(result)
          .toMatchObject({
            cityId:
              CITY_ID,
            viewerHasSaved:
              true,
            savedItem: {
              id:
                SAVED_ITEM_ID,
            },
          });
      },
    );

    test(
      "rejects a missing or inactive city",
      async () => {
        repositoryMock
          .findActiveCity
          .mockResolvedValue(null);

        await expect(
          CitySavesService.saveCity({
            cityId:
              CITY_ID,
            userId:
              USER_ID,
          }),
        ).rejects.toMatchObject({
          code:
            "CITY.NOT_FOUND",
          statusCode:
            404,
        });

        expect(repositoryMock.save)
          .not.toHaveBeenCalled();
      },
    );

    test(
      "maps a concurrently removed city to not found",
      async () => {
        repositoryMock.save
          .mockResolvedValue(null);

        await expect(
          CitySavesService.saveCity({
            cityId:
              CITY_ID,
            userId:
              USER_ID,
          }),
        ).rejects.toMatchObject({
          code:
            "CITY.NOT_FOUND",
          statusCode:
            404,
        });
      },
    );

    test(
      "removes a saved city",
      async () => {
        repositoryMock.remove
          .mockResolvedValue(undefined);

        repositoryMock.getState
          .mockResolvedValue(
            createSavedState({
              is_active:
                false,
            }),
          );

        const result =
          await CitySavesService
            .removeSavedCity({
              cityId:
                CITY_ID,
              userId:
                USER_ID,
            });

        expect(result)
          .toEqual({
            cityId:
              CITY_ID,
            viewerHasSaved:
              false,
            savedItem:
              null,
          });
      },
    );

    test(
      "keeps repeated removal idempotent",
      async () => {
        repositoryMock.remove
          .mockResolvedValue(undefined);

        repositoryMock.getState
          .mockResolvedValue(null);

        const result =
          await CitySavesService
            .removeSavedCity({
              cityId:
                CITY_ID,
              userId:
                USER_ID,
            });

        expect(result.viewerHasSaved)
          .toBe(false);
      },
    );
  },
);
