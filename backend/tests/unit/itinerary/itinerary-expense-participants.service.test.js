import { jest } from "@jest/globals";

const repositoryMock = {
  findOwnedTrip: jest.fn(),
  findActive: jest.fn(),
  findAccessibleTrip: jest.fn(),
  listActive: jest.fn(),
  findEligibleConnection: jest.fn(),
  add: jest.fn(),
  removeOwned: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-expense-participants.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-expense-participants.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const tripId = "22222222-2222-4222-8222-222222222222";
const ownerUserId = "33333333-3333-4333-8333-333333333333";
const targetUserId = "44444444-4444-4444-8444-444444444444";

describe("ItineraryExpenseParticipantsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryMock.findOwnedTrip.mockResolvedValue({ trip_id: tripId });
    repositoryMock.findActive.mockResolvedValue(null);
    repositoryMock.findEligibleConnection.mockResolvedValue({
      user_id: targetUserId,
      username: "friend",
      display_name: "Friend",
    });
    repositoryMock.add.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      trip_id: tripId,
      status: "ACTIVE",
      joined_at: "2026-09-09T09:00:00.000Z",
      created_at: "2026-09-09T09:00:00.000Z",
      updated_at: "2026-09-09T09:00:00.000Z",
    });
  });

  test("adds an accepted connection", async () => {
    const result = await service.addParticipant({
      itineraryId,
      ownerUserId,
      targetUserId,
    });

    expect(repositoryMock.add).toHaveBeenCalledWith({
      tripId,
      userId: targetUserId,
      addedBy: ownerUserId,
    });
    expect(result.participant).toMatchObject({
      itineraryId,
      tripId,
      status: "ACTIVE",
      user: { id: targetUserId },
    });
  });

  test("lists active participants for an accessible trip", async () => {
    repositoryMock.findAccessibleTrip.mockResolvedValue({ trip_id: tripId });
    repositoryMock.listActive.mockResolvedValue([{
      id: "55555555-5555-4555-8555-555555555555",
      trip_id: tripId,
      user_id: ownerUserId,
      username: "owner",
      display_name: "Owner",
      is_verified: true,
      profile_photo_id: null,
      is_owner: true,
      status: "ACTIVE",
      joined_at: "2026-09-09T09:00:00.000Z",
    }]);

    const result = await service.listParticipants({
      itineraryId,
      userId: ownerUserId,
    });

    expect(result.totalCount).toBe(1);
    expect(result.participants[0]).toMatchObject({
      isOwner: true,
      user: { id: ownerUserId, profilePhoto: null },
    });
  });

  test("hides an inaccessible participant list", async () => {
    repositoryMock.findAccessibleTrip.mockResolvedValue(null);
    await expect(service.listParticipants({
      itineraryId,
      userId: targetUserId,
    })).rejects.toMatchObject({
      code: "ITINERARY.NOT_FOUND",
      statusCode: 404,
    });
  });

  test("soft removes an active participant", async () => {
    repositoryMock.removeOwned.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      user_id: targetUserId,
      status: "REMOVED",
      removed_at: "2026-09-09T10:00:00.000Z",
    });

    const result = await service.removeParticipant({
      itineraryId,
      ownerUserId,
      targetUserId,
    });

    expect(result).toMatchObject({
      removed: true,
      userId: targetUserId,
      status: "REMOVED",
    });
  });

  test("does not remove the trip owner", async () => {
    await expect(service.removeParticipant({
      itineraryId,
      ownerUserId,
      targetUserId: ownerUserId,
    })).rejects.toMatchObject({
      code: "ITINERARY.EXPENSE_OWNER_REMOVAL_FORBIDDEN",
      statusCode: 409,
    });
    expect(repositoryMock.removeOwned).not.toHaveBeenCalled();
  });

  test("hides a missing or unowned participant", async () => {
    repositoryMock.removeOwned.mockResolvedValue(null);
    await expect(service.removeParticipant({
      itineraryId,
      ownerUserId,
      targetUserId,
    })).rejects.toMatchObject({
      code: "ITINERARY.EXPENSE_PARTICIPANT_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("requires an owned itinerary", async () => {
    repositoryMock.findOwnedTrip.mockResolvedValue(null);
    await expect(service.addParticipant({ itineraryId, ownerUserId, targetUserId }))
      .rejects.toMatchObject({ code: "ITINERARY.NOT_FOUND", statusCode: 404 });
  });

  test("requires an existing trip", async () => {
    repositoryMock.findOwnedTrip.mockResolvedValue({ trip_id: null });
    await expect(service.addParticipant({ itineraryId, ownerUserId, targetUserId }))
      .rejects.toMatchObject({ code: "ITINERARY.TRIP_NOT_STARTED", statusCode: 409 });
  });

  test("rejects an active duplicate", async () => {
    repositoryMock.findActive.mockResolvedValue({ id: "existing" });
    await expect(service.addParticipant({ itineraryId, ownerUserId, targetUserId }))
      .rejects.toMatchObject({
        code: "ITINERARY.EXPENSE_PARTICIPANT_ALREADY_EXISTS",
        statusCode: 409,
      });
  });

  test("rejects a user who is not an accepted connection", async () => {
    repositoryMock.findEligibleConnection.mockResolvedValue(null);
    await expect(service.addParticipant({ itineraryId, ownerUserId, targetUserId }))
      .rejects.toMatchObject({
        code: "ITINERARY.EXPENSE_PARTICIPANT_NOT_ELIGIBLE",
        statusCode: 422,
      });
  });
});
