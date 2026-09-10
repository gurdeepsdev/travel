import { jest } from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";
const ITINERARY_ID =
  "11111111-1111-4111-8111-111111111111";

const repositoryMock = {
  createPlanTogether: jest.fn(),
  getOrCreateOwnedPublicShare:
    jest.fn(),
  create: jest.fn(),
  findAccessibleById: jest.fn(),
  findAccessibleDashboard: jest.fn(),
  listOwned: jest.fn(),
  updateOwnedLifecycleStatus:
    jest.fn(),
  replaceOwnedJson: jest.fn(),
  softDeleteOwned: jest.fn(),
  updateOwnedName: jest.fn(),
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
  test('saves Plan Together atomically and returns the group', async () => {
    const payload={planTogether:true,city_id:'delhi',summary:{num_days:1},days:[]};
    const itinerary={id:ITINERARY_ID,created_by:USER_ID,title:'Delhi itinerary',
      itinerary_json:{city_id:'delhi'},created_at:new Date(),updated_at:new Date()};
    repositoryMock.createPlanTogether.mockResolvedValue({itinerary,group:{
      id:ITINERARY_ID,itinerary_id:ITINERARY_ID,owner_id:USER_ID,status:'ACTIVE',
    }});
    const result=await ItineraryService.saveItinerary({userId:USER_ID,payload});
    expect(result.group).toMatchObject({itineraryId:ITINERARY_ID,ownerId:USER_ID,status:'ACTIVE'});
    expect(repositoryMock.create).not.toHaveBeenCalled();
    expect(repositoryMock.createPlanTogether.mock.calls[0][0].itineraryJson).not.toHaveProperty('planTogether');
    expect(payload.planTogether).toBe(true);
  });

  test('propagates Plan Together transaction failure without a solo fallback', async () => {
    repositoryMock.createPlanTogether.mockRejectedValue(new Error('Group write failed'));
    await expect(ItineraryService.saveItinerary({userId:USER_ID,payload:{planTogether:true,
      city_id:'delhi',summary:{num_days:1}}})).rejects.toThrow('Group write failed');
    expect(repositoryMock.create).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test(
    "creates an owned itinerary share link",
    async () => {
      repositoryMock
        .getOrCreateOwnedPublicShare
        .mockResolvedValue({
          id:
            "22222222-2222-4222-8222-222222222222",
          itinerary_id:
            ITINERARY_ID,
          share_token: "share-token",
          access_type: "public",
          expires_at: null,
          created_at:
            new Date(
              "2026-08-31T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .createShareLink({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          });

      expect(result).toMatchObject({
        itineraryId: ITINERARY_ID,
        share: {
          url:
            "https://artictern.com/i/share-token",
          accessType: "public",
          expiresAt: null,
        },
      });
    },
  );

  test(
    "hides an unowned itinerary share request",
    async () => {
      repositoryMock
        .getOrCreateOwnedPublicShare
        .mockResolvedValue(null);

      await expect(
        ItineraryService
          .createShareLink({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          }),
      ).rejects.toMatchObject({
        code: "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );

  test(
    "updates an owned itinerary name",
    async () => {
      repositoryMock.updateOwnedName
        .mockResolvedValue({
          id: ITINERARY_ID,
          title: "Himachal Adventure",
          updated_at:
            new Date(
              "2026-08-31T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .updateItineraryName({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            name: "Himachal Adventure",
          });

      expect(
        repositoryMock.updateOwnedName,
      ).toHaveBeenCalledWith({
        itineraryId:
          ITINERARY_ID,
        userId: USER_ID,
        name: "Himachal Adventure",
      });
      expect(result.itinerary)
        .toMatchObject({
          id: ITINERARY_ID,
          name: "Himachal Adventure",
        });
    },
  );

  test(
    "hides an unowned itinerary name update",
    async () => {
      repositoryMock.updateOwnedName
        .mockResolvedValue(null);

      await expect(
        ItineraryService
          .updateItineraryName({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
            name: "Private Trip",
          }),
      ).rejects.toMatchObject({
        code: "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );

  test(
    "soft-deletes an owned itinerary",
    async () => {
      repositoryMock.softDeleteOwned
        .mockResolvedValue({
          id: ITINERARY_ID,
          deleted_at:
            new Date(
              "2026-08-31T10:00:00Z",
            ),
        });

      const result =
        await ItineraryService
          .deleteItinerary({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          });

      expect(
        repositoryMock.softDeleteOwned,
      ).toHaveBeenCalledWith({
        itineraryId:
          ITINERARY_ID,
        userId: USER_ID,
      });
      expect(result).toMatchObject({
        deleted: true,
        itinerary: {
          id: ITINERARY_ID,
        },
      });
    },
  );

  test(
    "hides missing, deleted, and unowned itinerary deletes",
    async () => {
      repositoryMock.softDeleteOwned
        .mockResolvedValue(null);

      await expect(
        ItineraryService
          .deleteItinerary({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          }),
      ).rejects.toMatchObject({
        code: "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );

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
      ).toMatchObject({
        itineraryJson: {
          city_id: "delhi",
        },
      });
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
        tripStatus: "COMPLETED",
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
    "returns only planned itineraries owned by the user",
    async () => {
      repositoryMock.listOwned
        .mockResolvedValue({
          rows: [],
          hasMore: false,
          lastRow: null,
        });

      const result =
        await ItineraryService
          .listItineraries({
            userId: USER_ID,
            limit: 20,
            tripStatus: "PLANNED",
          });

      expect(
        repositoryMock.listOwned,
      ).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 20,
        cursor: null,
        tripStatus: "PLANNED",
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

  test.each([
    "UPCOMING",
    "LIVE",
    "COMPLETED",
  ])(
    "passes the %s itinerary filter to the repository",
    async (tripStatus) => {
      repositoryMock.listOwned
        .mockResolvedValue({
          rows: [],
          hasMore: false,
          lastRow: null,
        });

      await ItineraryService
        .listItineraries({
          userId: USER_ID,
          limit: 20,
          tripStatus,
        });

      expect(
        repositoryMock.listOwned,
      ).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 20,
        cursor: null,
        tripStatus,
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
      repositoryMock.findAccessibleById
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
        repositoryMock.findAccessibleById,
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
      repositoryMock.findAccessibleById
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

  test(
    "returns the complete itinerary dashboard summary",
    async () => {
      repositoryMock.findAccessibleDashboard
        .mockResolvedValue({
          id: ITINERARY_ID,
          created_by: USER_ID,
          title: "Delhi itinerary",
          duration_days: 2,
          visibility: "private",
          trip_status: "UPCOMING",
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
          trip_id:
            "22222222-2222-4222-8222-222222222222",
          document_count: 3,
          document_counts_by_type: {
            PASSPORT: 1,
            HOTEL_BOOKING: 2,
          },
          essential_count: 4,
          completed_essential_count: 3,
          expense_count: 3,
          expense_totals_by_currency: [
            {
              currencyCode: "INR",
              totalAmount: 4500,
            },
          ],
          expense_totals_by_category: [
            {
              category: "FOOD",
              currencyCode: "INR",
              expenseCount: 2,
              totalAmount: 1500,
            },
          ],
        });

      const result =
        await ItineraryService
          .getItineraryDashboard({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          });

      expect(result).toMatchObject({
        itinerary: {
          id: ITINERARY_ID,
          itineraryJson: {
            city_id: "delhi",
          },
        },
        documents: {
          totalCount: 3,
          countsByType: {
            PASSPORT: 1,
            VISA: 0,
            HOTEL_BOOKING: 2,
          },
        },
        essentials: {
          totalCount: 4,
          markedCount: 3,
          unmarkedCount: 1,
          completionPercentage: 75,
        },
        expenses: {
          expenseCount: 3,
        },
      });
    },
  );

  test(
    "returns zero dashboard metrics before a trip exists",
    async () => {
      repositoryMock.findAccessibleDashboard
        .mockResolvedValue({
          id: ITINERARY_ID,
          created_by: USER_ID,
          title: "Delhi itinerary",
          duration_days: 1,
          visibility: "private",
          trip_status: "SAVED",
          ai_generated: true,
          itinerary_json: {},
          created_at:
            new Date(
              "2026-08-24T10:00:00Z",
            ),
          updated_at:
            new Date(
              "2026-08-24T10:00:00Z",
            ),
          trip_id: null,
        });

      const result =
        await ItineraryService
          .getItineraryDashboard({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          });

      expect(result).toMatchObject({
        tripId: null,
        documents: { totalCount: 0 },
        essentials: {
          totalCount: 0,
          completionPercentage: 0,
        },
        expenses: {
          expenseCount: 0,
          totalsByCurrency: [],
          totalsByCategory: [],
        },
      });
    },
  );

  test(
    "hides an unowned itinerary dashboard",
    async () => {
      repositoryMock.findAccessibleDashboard
        .mockResolvedValue(null);

      await expect(
        ItineraryService
          .getItineraryDashboard({
            itineraryId:
              ITINERARY_ID,
            userId: USER_ID,
          }),
      ).rejects.toMatchObject({
        code: "ITINERARY.NOT_FOUND",
        statusCode: 404,
      });
    },
  );
});
