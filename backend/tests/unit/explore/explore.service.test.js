import {
  jest,
} from "@jest/globals";

const VIEWER_USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const POST_ID =
  "2cbc0cee-4d0a-43e1-ae93-ab4a66211100";

const SECOND_POST_ID =
  "33333333-3333-4333-8333-333333333333";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";

const PLACE_ID =
  "72bf8c7b-c684-4046-9f97-cfb1f569e59a";

const CREATED_AT =
  "2026-08-19 10:00:00.000000";

const exploreRepositoryMock = {
  listPopularCountries:
    jest.fn(),

  listPopularCities:
    jest.fn(),

  listPlaces:
    jest.fn(),

  listFeedPostIds:
    jest.fn(),

  listVideoPostIds:
    jest.fn(),
};

const postsRepositoryMock = {
  getPostsByIds:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/explore/repositories/explore.repository.js",
  () => ({
    default:
      exploreRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/posts.repository.js",
  () => ({
    default:
      postsRepositoryMock,
  }),
);

const {
  encodeCursor,
  decodeCursor,
} = await import(
  "../../../src/shared/utils/cursor.js"
);

const {
  default: ExploreService,
} = await import(
  "../../../src/modules/explore/services/explore.service.js"
);

describe(
  "ExploreService",
  () => {
    beforeEach(
      () => {
        jest.clearAllMocks();

        exploreRepositoryMock
          .listPopularCountries
          .mockResolvedValue(
            [],
          );

        exploreRepositoryMock
          .listPopularCities
          .mockResolvedValue(
            [],
          );

        exploreRepositoryMock
          .listPlaces
          .mockResolvedValue(
            [],
          );
      },
    );

    test(
      "returns exactly twenty posts for anonymous viewers without pagination",
      async () => {
        exploreRepositoryMock
          .listFeedPostIds
          .mockResolvedValue({
            rows: [
              {
                id:
                  POST_ID,
              },
              {
                id:
                  SECOND_POST_ID,
              },
            ],

            hasMore:
              true,

            lastRow: {
              id:
                SECOND_POST_ID,

              cursor_created_at:
                CREATED_AT,
            },
          });

        postsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            {
              id:
                POST_ID,
            },
            {
              id:
                SECOND_POST_ID,
            },
          ]);

        const result =
          await ExploreService
            .getFeed({
              viewerUserId:
                null,

              limit:
                50,
            });

        expect(
          exploreRepositoryMock
            .listFeedPostIds,
        ).toHaveBeenCalledWith({
          viewerUserId:
            null,

          limit:
            20,

          cursor:
            null,
        });

        expect(
          result.items.map(
            (item) =>
              item.type,
          ),
        ).toEqual([
          "POST",
          "POST",
          "POPULAR_CITIES",
          "NEARBY_PLACES",
        ]);

        expect(
          result.items.map(
            (item) =>
              item.position,
          ),
        ).toEqual([
          1,
          2,
          3,
          4,
        ]);

        expect(
          result.pagination,
        ).toEqual({
          hasMore:
            false,

          nextCursor:
            null,
        });
      },
    );

    test(
      "returns an opaque next cursor for authenticated viewers",
      async () => {
        exploreRepositoryMock
          .listFeedPostIds
          .mockResolvedValue({
            rows: [
              {
                id:
                  POST_ID,
              },
            ],

            hasMore:
              true,

            lastRow: {
              id:
                POST_ID,

              cursor_created_at:
                CREATED_AT,
            },
          });

        postsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            {
              id:
                POST_ID,
            },
          ]);

        const result =
          await ExploreService
            .getFeed({
              viewerUserId:
                VIEWER_USER_ID,

              limit:
                20,
            });

        expect(
          result.pagination
            .hasMore,
        ).toBe(
          true,
        );

        expect(
          decodeCursor(
            result.pagination
              .nextCursor,
          ),
        ).toEqual({
          createdAt:
            CREATED_AT,

          id:
            POST_ID,
        });
      },
    );

    test(
      "returns only posts after the first authenticated page",
      async () => {
        const cursor =
          encodeCursor({
            createdAt:
              CREATED_AT,

            id:
              POST_ID,
          });

        exploreRepositoryMock
          .listFeedPostIds
          .mockResolvedValue({
            rows: [
              {
                id:
                  SECOND_POST_ID,
              },
            ],

            hasMore:
              false,

            lastRow: {
              id:
                SECOND_POST_ID,

              cursor_created_at:
                "2026-08-18 10:00:00.000000",
            },
          });

        postsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            {
              id:
                SECOND_POST_ID,
            },
          ]);

        const result =
          await ExploreService
            .getFeed({
              viewerUserId:
                VIEWER_USER_ID,

              limit:
                20,

              cursor,
            });

        expect(
          exploreRepositoryMock
            .listFeedPostIds,
        ).toHaveBeenCalledWith({
          viewerUserId:
            VIEWER_USER_ID,

          limit:
            20,

          cursor: {
            createdAt:
              CREATED_AT,

            id:
              POST_ID,
          },
        });

        expect(
          exploreRepositoryMock
            .listPopularCities,
        ).not.toHaveBeenCalled();

        expect(
          exploreRepositoryMock
            .listPlaces,
        ).not.toHaveBeenCalled();

        expect(
          result.items,
        ).toEqual([
          {
            type:
              "POST",

            post: {
              id:
                SECOND_POST_ID,
            },

            position:
              1,
          },
        ]);

        expect(
          result.pagination,
        ).toEqual({
          hasMore:
            false,

          nextCursor:
            null,
        });
      },
    );

    test(
      "returns mapped popular countries",
      async () => {
        const previousBaseUrl =
          process.env
            .API_PUBLIC_BASE_URL;

        process.env.API_PUBLIC_BASE_URL =
          "https://apitest.artictern.com";

        exploreRepositoryMock
          .listPopularCountries
          .mockResolvedValue([
            {
              id:
                "060de7c3-9c68-4507-aff7-62a5411bf60a",
              name:
                "India",
              code:
                "IN",
              description:
                "Country description",
              phone_prefix:
                "+91",
              timezone:
                "Asia/Kolkata",
              city_count:
                10,
              place_count:
                100,
              places_with_media:
                50,
              image_asset_id:
                "42225d26-2755-4759-b0ab-217b2192f581",
              image_storage_provider:
                "local",
              image_storage_key:
                "country-icons/india.png",
              image_mime_type:
                "image/png",
              image_is_public:
                true,
            },
          ]);

        const result =
          await ExploreService
            .getCountries({
              limit:
                10,
            });

        expect(
          exploreRepositoryMock
            .listPopularCountries,
        ).toHaveBeenCalledWith({
          limit:
            10,
        });

        expect(result)
          .toEqual({
            countries: [
              expect.objectContaining({
                title:
                  "India",
                name:
                  "India",
                code:
                  "IN",
                cityCount:
                  10,
                placeCount:
                  100,
                image: {
                  id:
                    "42225d26-2755-4759-b0ab-217b2192f581",
                  url:
                    "https://apitest.artictern.com/api/v1/media/assets/42225d26-2755-4759-b0ab-217b2192f581/content",
                  mimeType:
                    "image/png",
                },
              }),
            ],
          });

        if (previousBaseUrl) {
          process.env.API_PUBLIC_BASE_URL =
            previousBaseUrl;
        } else {
          delete process.env
            .API_PUBLIC_BASE_URL;
        }
      },
    );

    test(
      "returns mapped popular cities",
      async () => {
        exploreRepositoryMock
          .listPopularCities
          .mockResolvedValue([
            {
              id:
                CITY_ID,

              name:
                "Noida",

              official_name:
                "New Okhla Industrial Development Authority",

              latitude:
                28.5355,

              longitude:
                77.391,

              country_id:
                "060de7c3-9c68-4507-aff7-62a5411bf60a",

              country_name:
                "India",

              country_code:
                "IN",

              place_count:
                1,

              places_with_media:
                0,

              viewer_saved:
                true,
            },
          ]);

        const result =
          await ExploreService
            .getCities({
              category:
                "FUN",

              limit:
                10,

              viewerUserId:
                VIEWER_USER_ID,
            });

        expect(
          exploreRepositoryMock
            .listPopularCities,
        ).toHaveBeenCalledWith({
          category:
            "FUN",

          limit:
            10,

          viewerUserId:
            VIEWER_USER_ID,
        });

        expect(
          result.cities[0],
        ).toMatchObject({
          id:
            CITY_ID,

          name:
            "Noida",

          placeCount:
            1,

          viewerState: {
            saved:
              true,
          },
        });
      },
    );

    test(
      "uses For You when no city category is supplied",
      async () => {
        await ExploreService
          .getCities();

        expect(
          exploreRepositoryMock
            .listPopularCities,
        ).toHaveBeenCalledWith({
          category:
            "FOR_YOU",
          limit:
            10,
          viewerUserId:
            null,
        });
      },
    );

    test(
      "returns places belonging to the selected city",
      async () => {
        exploreRepositoryMock
          .listPlaces
          .mockResolvedValue([
            createPlaceRow(),
          ]);

        const result =
          await ExploreService
            .getCityPlaces({
              cityId:
                CITY_ID,

              limit:
                20,
            });

        expect(
          exploreRepositoryMock
            .listPlaces,
        ).toHaveBeenCalledWith({
          cityId:
            CITY_ID,

          limit:
            20,

          latitude:
            null,

          longitude:
            null,
        });

        expect(result).toMatchObject({
          cityId:
            CITY_ID,

          places: [
            {
              id:
                PLACE_ID,

              name:
                "DLF Mall of India",
            },
          ],
        });
      },
    );

    test(
      "returns location-ranked places when coordinates are supplied",
      async () => {
        exploreRepositoryMock
          .listPlaces
          .mockResolvedValue([
            createPlaceRow({
              distance_km:
                12.105558,
            }),
          ]);

        const result =
          await ExploreService
            .getPlaces({
              latitude:
                28.6139,

              longitude:
                77.209,

              radiusKm:
                100,

              limit:
                10,
            });

        expect(
          exploreRepositoryMock
            .listPlaces,
        ).toHaveBeenCalledWith({
          latitude:
            28.6139,

          longitude:
            77.209,

          radiusKm:
            100,

          limit:
            10,
        });

        expect(result).toMatchObject({
          locationApplied:
            true,

          places: [
            {
              id:
                PLACE_ID,

              distanceKm:
                12.11,
            },
          ],
        });
      },
    );

    test(
      "uses global place ordering when coordinates are unavailable",
      async () => {
        exploreRepositoryMock
          .listPlaces
          .mockResolvedValue([
            createPlaceRow(),
          ]);

        const result =
          await ExploreService
            .getPlaces({
              limit:
                10,
            });

        expect(
          exploreRepositoryMock
            .listPlaces,
        ).toHaveBeenCalledWith({
          latitude:
            null,

          longitude:
            null,

          radiusKm:
            50,

          limit:
            10,
        });

        expect(result).toMatchObject({
          locationApplied:
            false,

          places: [
            {
              id:
                PLACE_ID,

              distanceKm:
                null,
            },
          ],
        });
      },
    );

    test(
      "returns video posts with the Explore post envelope",
      async () => {
        exploreRepositoryMock
          .listVideoPostIds
          .mockResolvedValue({
            rows: [
              {
                id:
                  POST_ID,
                cursor_created_at:
                  CREATED_AT,
              },
            ],
            hasMore: true,
            lastRow: {
              id:
                POST_ID,
              cursor_created_at:
                CREATED_AT,
            },
          });

        postsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            {
              id:
                POST_ID,
              assets: [
                {
                  mediaType:
                    "video",
                },
              ],
            },
          ]);

        const result =
          await ExploreService
            .getVideos({
              viewerUserId:
                VIEWER_USER_ID,
              limit: 10,
            });

        expect(
          exploreRepositoryMock
            .listVideoPostIds,
        ).toHaveBeenCalledWith({
          viewerUserId:
            VIEWER_USER_ID,
          limit: 10,
          cursor: null,
        });

        expect(result.items).toEqual([
          {
            type: "POST",
            post: {
              id:
                POST_ID,
              assets: [
                {
                  mediaType:
                    "video",
                },
              ],
            },
            position: 1,
          },
        ]);

        expect(result.pagination)
          .toMatchObject({
            hasMore: true,
          });

        expect(
          decodeCursor(
            result.pagination
              .nextCursor,
          ),
        ).toEqual({
          createdAt:
            CREATED_AT,
          id:
            POST_ID,
        });
      },
    );
  },
);

function createPlaceRow(
  overrides = {},
) {
  return {
    id:
      PLACE_ID,

    name:
      "DLF Mall of India",

    description:
      "Shopping destination in Noida.",

    address:
      "Sector 18, Noida",

    postal_code:
      "201301",

    latitude:
      28.5672,

    longitude:
      77.321,

    rating:
      4.5,

    review_count:
      1250,

    recommended_duration:
      "3 hours",

    booking_type:
      "WALK_IN",

    require_ticket:
      false,

    itinerary_worthiness:
      true,

    distance_km:
      null,

    city_id:
      CITY_ID,

    city_name:
      "Noida",

    city_official_name:
      "New Okhla Industrial Development Authority",

    country_id:
      "060de7c3-9c68-4507-aff7-62a5411bf60a",

    country_name:
      "India",

    country_code:
      "IN",

    category_id:
      "3318a90f-a088-4ace-a14c-dd533af31248",

    category_name:
      "Shopping Mall",

    image_asset_id:
      null,

    ...overrides,
  };
}
