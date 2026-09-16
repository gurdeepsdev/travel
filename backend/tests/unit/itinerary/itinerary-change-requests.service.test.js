import { jest } from "@jest/globals";

const repository = {
  create: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  review: jest.fn(),
  cancel: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-change-requests.repository.js",
  () => ({ default: repository }),
);

const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-change-requests.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const timestamp = new Date("2026-09-16T10:00:00.000Z");
const row = {
  id: requestId,
  itinerary_id: itineraryId,
  requested_by: memberId,
  request_type: "UPDATE_ITINERARY",
  proposed_data: { days: [{ day: 1, items: [{ item_type: "poi" }] }], totalPlaces: 1 },
  message: "Add this place",
  status: "PENDING",
  reviewed_by: null,
  reviewed_at: null,
  review_message: null,
  base_itinerary_updated_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
};

describe("ItineraryChangeRequestsService", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates a place-only request and calculates its place count", async () => {
    repository.create.mockResolvedValue(row);
    const result = await service.create({
      itineraryId,
      userId: memberId,
      input: {
        days: [
          { day: 1, items: [{ item_type: "poi" }, { item_type: "restaurant" }] },
          { day: 2, items: [] },
        ],
        message: "Change places",
      },
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      proposedData: expect.objectContaining({ totalPlaces: 2 }),
    }));
    expect(result.changeRequest.requestType).toBe("PLACE_CHANGES");
  });

  test("hides requests from ineligible users", async () => {
    repository.create.mockResolvedValue(null);
    await expect(service.create({
      itineraryId,
      userId: memberId,
      input: { days: [{ day: 1, items: [] }] },
    })).rejects.toMatchObject({
      code: "ITINERARY.CHANGE_REQUEST_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("returns conflict when approval becomes stale", async () => {
    repository.review.mockResolvedValue({
      request: { ...row, status: "STALE" },
      stale: true,
    });
    await expect(service.review({
      itineraryId,
      requestId,
      userId: memberId,
      input: { decision: "ACCEPTED" },
    })).rejects.toMatchObject({
      code: "ITINERARY.CHANGE_REQUEST_STALE",
      statusCode: 409,
    });
  });

  test("cancels only an available pending request", async () => {
    repository.cancel.mockResolvedValue({ ...row, status: "CANCELLED" });
    const result = await service.cancel({ itineraryId, requestId, userId: memberId });
    expect(result.changeRequest.status).toBe("CANCELLED");
  });
});
