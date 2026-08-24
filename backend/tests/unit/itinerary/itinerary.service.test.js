import { jest } from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";
const ITINERARY_ID =
  "11111111-1111-4111-8111-111111111111";

const repositoryMock = {
  create: jest.fn(),
  findOwnedById: jest.fn(),
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
