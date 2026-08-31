import { jest } from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";
const ITINERARY_ID =
  "11111111-1111-4111-8111-111111111111";

const repositoryMock = {
  create: jest.fn(),
  findOwnedById: jest.fn(),
  listOwned: jest.fn(),
  updateOwnedLifecycleStatus:
    jest.fn(),
  replaceOwnedJson: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary.repository.js",
  () => ({
    default: repositoryMock,
  }),
);

const { default: ItineraryService } =
  await import(
    "../../../src/modules/itinerary/itinerary.service.js"
  );

describe("ItineraryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(
    "moves a saved itinerary to an upcoming trip",
    async () => {
      repositoryMock
        .updateOwnedLifecycleStatus
        .mockResolvedValue({
          id: ITINERARY_ID,
          trip_id:
            "22222222-2222-4222-8222-222222222222",
          previous_status: "SAVED",
          current_status: "UPCOMING",
          updated: true,
          started_at: null,
          completed_at: null,
          updated_at:
            new Date(
              "2026-08-26T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .updateItineraryStatus({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            status: "UPCOMING",
          });

      expect(
        repositoryMock
          .updateOwnedLifecycleStatus,
      ).toHaveBeenCalledWith({
        itineraryId:
          ITINERARY_ID,
        userId: USER_ID,
        status: "UPCOMING",
      });
      expect(result).toMatchObject({
        itineraryId:
          ITINERARY_ID,
        previousStatus: "SAVED",
        status: "UPCOMING",
        updated: true,
      });
    },
  );

  test(
    "replaces an owned itinerary JSON payload",
    async () => {
      const payload = {
        userId:
          "9bf9aa6d-0ab3-4563-b1c2-754cc2d38a13",
        request_id:
          "519e8514-6a00-43ac-b1e3-78277698f13a",
        status: "success",
        mode: "future",
        city_id: "new-delhi",
        summary: {
          num_days: 2,
          total_places: 0,
        },
        days: [
          { day: 1, items: [] },
          { day: 2, items: [] },
        ],
      };

      repositoryMock.replaceOwnedJson
        .mockImplementation(
          async (input) => ({
            id: ITINERARY_ID,
            created_by: USER_ID,
            title: input.title,
            duration_days:
              input.durationDays,
            visibility: "private",
            trip_status: "ongoing",
            ai_generated: true,
            itinerary_json:
              input.itineraryJson,
            created_at:
              new Date(
                "2026-08-24T10:00:00Z",
              ),
            updated_at:
              new Date(
                "2026-08-27T10:00:00Z",
              ),
          }),
        );

      const result =
        await ItineraryService
          .updateItinerary({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            payload,
          });

      expect(
        repositoryMock.replaceOwnedJson,
      ).toHaveBeenCalledWith({
        itineraryId:
          ITINERARY_ID,
        userId: USER_ID,
        title:
          "New Delhi itinerary",
        durationDays: 2,
        itineraryJson:
          expect.not.objectContaining({
            userId:
              expect.anything(),
          }),
      });
      expect(result.itinerary)
        .toMatchObject({
          id: ITINERARY_ID,
          tripStatus: "ongoing",
          durationDays: 2,
        });
    },
  );

  test(
    "hides an unowned itinerary update",
    async () => {
      repositoryMock.replaceOwnedJson
        .mockResolvedValue(null);

      await expect(
        ItineraryService.updateItinerary({
          itineraryId:
            ITINERARY_ID,
          userId: USER_ID,
          payload: {
            request_id:
              "519e8514-6a00-43ac-b1e3-78277698f13a",
            status: "success",
            mode: "future",
            city_id: "delhi",
            summary: {
              num_days: 1,
              total_places: 0,
            },
            days: [
              { day: 1, items: [] },
            ],
          },
        }),
      ).rejects.toMatchObject({
        code: "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );

  test(
    "keeps repeated status updates idempotent",
    async () => {
      repositoryMock
        .updateOwnedLifecycleStatus
        .mockResolvedValue({
          id: ITINERARY_ID,
          trip_id:
            "22222222-2222-4222-8222-222222222222",
          previous_status:
            "UPCOMING",
          current_status:
            "UPCOMING",
          updated: false,
          started_at: null,
          completed_at: null,
          updated_at:
            new Date(
              "2026-08-26T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .updateItineraryStatus({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            status: "UPCOMING",
          });

      expect(result.updated)
        .toBe(false);
    },
  );

  test(
    "rejects skipped or backward status transitions",
    async () => {
      repositoryMock
        .updateOwnedLifecycleStatus
        .mockResolvedValue({
          invalid_transition: true,
          current_status: "SAVED",
        });

      await expect(
        ItineraryService
          .updateItineraryStatus({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            status: "LIVE",
          }),
      ).rejects.toMatchObject({
        code:
          "ITINERARY.INVALID_STATUS_TRANSITION",
        statusCode: 409,
        details: {
          currentStatus: "SAVED",
          requestedStatus: "LIVE",
        },
      });
    },
  );

  test(
    "hides an unowned itinerary during status updates",
    async () => {
      repositoryMock
        .updateOwnedLifecycleStatus
        .mockResolvedValue(null);

      await expect(
        ItineraryService
          .updateItineraryStatus({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            status: "UPCOMING",
          }),
      ).rejects.toMatchObject({
        code:
          "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );

  test(
    "returns only the authenticated user's itineraries",
    async () => {
      repositoryMock.listOwned
        .mockResolvedValue({
          rows: [
            {
              id: ITINERARY_ID,
              created_by: USER_ID,
              title: "Delhi itinerary",
              duration_days: 1,
              visibility: "private",
              trip_status: "planned",
              ai_generated: true,
              itinerary_json: {
                city_id: "delhi",
              },
              created_at:
                new Date(
                  "2026-08-24T10:00:00Z",
                ),
              updated_at:
                new Date(
                  "2026-08-24T10:00:00Z",
                ),
            },
          ],
          hasMore: false,
          lastRow: null,
        });

      const result =
        await ItineraryService
          .listItineraries({
            userId: USER_ID,
            limit: 20,
          });

      expect(
        repositoryMock.listOwned,
      ).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 20,
        cursor: null,
        tripStatus: null,
      });

      expect(result)
        .toMatchObject({
          itineraries: [
            {
              id: ITINERARY_ID,
              createdBy: USER_ID,
            },
          ],
          pagination: {
            hasMore: false,
            nextCursor: null,
          },
        });

      expect(
        result.itineraries[0],
      ).not.toHaveProperty(
        "itineraryJson",
      );
    },
  );

  test(
    "returns only completed itineraries owned by the user",
    async () => {
      repositoryMock.listOwned
        .mockResolvedValue({
          rows: [],
          hasMore: false,
          lastRow: null,
        });

      const result =
        await ItineraryService
          .listCompletedItineraries({
            userId: USER_ID,
            limit: 20,
          });

      expect(
        repositoryMock.listOwned,
      ).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 20,
        cursor: null,
        tripStatus: "completed",
      });

      expect(result).toEqual({
        itineraries: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
        },
      });
    },
  );

  test(
    "saves generated JSON using the authenticated owner",
    async () => {
      const payload = {
        "user id":
          "9bf9aa6d-0ab3-4563-b1c2-754cc2d38a13",
        request_id:
          "519e8514-6a00-43ac-b1e3-78277698f13a",
        status: "success",
        mode: "future",
        city_id: "delhi",
        summary: {
          num_days: 1,
          total_places: 1,
        },
        days: [
          {
            day: 1,
            items: [
              {
                item_type: "poi",
                place_id:
                  "ChIJC03rqdriDDkRXT6SJRGXFwc",
              },
            ],
          },
        ],
      };

      repositoryMock.create
        .mockImplementation(
          async ({
            userId,
            title,
            durationDays,
            itineraryJson,
          }) => ({
            id: ITINERARY_ID,
            created_by: userId,
            title,
            duration_days:
              durationDays,
            visibility: "private",
            trip_status: "planned",
            ai_generated: true,
            itinerary_json:
              itineraryJson,
            created_at:
              new Date(
                "2026-08-24T10:00:00Z",
              ),
            updated_at:
              new Date(
                "2026-08-24T10:00:00Z",
              ),
          }),
        );

      const result =
        await ItineraryService
          .saveItinerary({
            userId: USER_ID,
            payload,
          });

      expect(
        repositoryMock.create,
      ).toHaveBeenCalledWith({
        userId: USER_ID,
        title: "Delhi itinerary",
        durationDays: 1,
        itineraryJson:
          expect.not.objectContaining({
            "user id":
              expect.anything(),
          }),
      });

      expect(result.itinerary)
        .toMatchObject({
          id: ITINERARY_ID,
          createdBy: USER_ID,
          title:
            "Delhi itinerary",
          durationDays: 1,
        });
    },
  );

  test(
    "returns an itinerary owned by the authenticated user",
    async () => {
      repositoryMock.findOwnedById
        .mockResolvedValue({
          id: ITINERARY_ID,
          created_by: USER_ID,
          title: "Delhi itinerary",
          duration_days: 1,
          visibility: "private",
          trip_status: "planned",
          ai_generated: true,
          itinerary_json: {
            request_id:
              "519e8514-6a00-43ac-b1e3-78277698f13a",
          },
          created_at:
            new Date(
              "2026-08-24T10:00:00Z",
            ),
          updated_at:
            new Date(
              "2026-08-24T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .getItinerary({
            itineraryId:
              ITINERARY_ID,
            userId:
              USER_ID,
          });

      expect(
        repositoryMock.findOwnedById,
      ).toHaveBeenCalledWith({
        itineraryId:
          ITINERARY_ID,
        userId:
          USER_ID,
      });

      expect(result.itinerary)
        .toMatchObject({
          id: ITINERARY_ID,
          createdBy: USER_ID,
          title: "Delhi itinerary",
        });
    },
  );

  test(
    "hides missing, deleted, or unowned itineraries",
    async () => {
      repositoryMock.findOwnedById
        .mockResolvedValue(null);

      await expect(
        ItineraryService.getItinerary({
          itineraryId:
            ITINERARY_ID,
          userId:
            USER_ID,
        }),
      ).rejects.toMatchObject({
        code:
          "ITINERARY.NOT_FOUND",
        message:
          "Itinerary not found.",
        statusCode: 404,
      });
    },
  );
});
