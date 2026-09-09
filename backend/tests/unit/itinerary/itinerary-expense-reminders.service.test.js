import { jest } from "@jest/globals";

const repository = {
  findAccessibleTrip: jest.fn(), findActiveParticipantIds: jest.fn(),
  getBalances: jest.fn(),
};
const redis = { set: jest.fn() };
const emitUserEvent = jest.fn();
jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-expenses.repository.js",
  () => ({ default: repository }),
);
jest.unstable_mockModule("../../../src/config/redis.js", () => ({ default: redis }));
jest.unstable_mockModule(
  "../../../src/realtime/realtime-server.js",
  () => ({ emitUserEvent }),
);
const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-expense-reminders.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const tripId = "22222222-2222-4222-8222-222222222222";
const creditor = "33333333-3333-4333-8333-333333333333";
const debtor = "44444444-4444-4444-8444-444444444444";

describe("ItineraryExpenseRemindersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findAccessibleTrip.mockResolvedValue({ trip_id: tripId });
    repository.findActiveParticipantIds.mockResolvedValue([creditor, debtor]);
    repository.getBalances.mockResolvedValue([
      { user_id: creditor, currency_code: "INR", net_amount: "30.00" },
      { user_id: debtor, currency_code: "INR", net_amount: "-30.00" },
    ]);
    redis.set.mockResolvedValue("OK");
  });

  test("emits a rate-limited reminder to an owing participant", async () => {
    const result = await service.create({ itineraryId, userId: creditor,
      input: { userId: debtor, currencyCode: "INR" } });
    expect(result.reminder.amountOwed).toBe(30);
    expect(redis.set).toHaveBeenCalledWith(expect.any(String), "1", "EX", 86400, "NX");
    expect(emitUserEvent).toHaveBeenCalledWith(debtor,
      "expense.reminder.created", expect.any(Object));
  });

  test("rejects a repeated reminder during the cooldown", async () => {
    redis.set.mockResolvedValue(null);
    await expect(service.create({ itineraryId, userId: creditor,
      input: { userId: debtor, currencyCode: "INR" } }))
      .rejects.toMatchObject({ code: "ITINERARY.EXPENSE_REMINDER_RATE_LIMITED" });
  });
});
