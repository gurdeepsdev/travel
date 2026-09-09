import { jest } from "@jest/globals";

const expensesRepository = {
  findAccessibleTrip: jest.fn(),
  findActiveParticipantIds: jest.fn(),
  getBalances: jest.fn(),
};
const repository = {
  create: jest.fn(), list: jest.fn(), findById: jest.fn(), resolve: jest.fn(),
};
jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-expenses.repository.js",
  () => ({ default: expensesRepository }),
);
jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-expense-settlements.repository.js",
  () => ({ default: repository }),
);
const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-expense-settlements.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const tripId = "22222222-2222-4222-8222-222222222222";
const debtor = "33333333-3333-4333-8333-333333333333";
const creditor = "44444444-4444-4444-8444-444444444444";

describe("ItineraryExpenseSettlementsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    expensesRepository.findAccessibleTrip.mockResolvedValue({ trip_id: tripId });
    expensesRepository.findActiveParticipantIds.mockResolvedValue([debtor, creditor]);
    expensesRepository.getBalances.mockResolvedValue([
      { user_id: debtor, currency_code: "INR", net_amount: "-50.00" },
      { user_id: creditor, currency_code: "INR", net_amount: "50.00" },
    ]);
  });

  test("creates a pending settlement within the outstanding balance", async () => {
    repository.create.mockResolvedValue({ id: "settlement", trip_id: tripId,
      from_user_id: debtor, to_user_id: creditor, amount: "40.00",
      currency_code: "INR", status: "PENDING", created_by: debtor });
    const result = await service.create({ itineraryId, userId: debtor,
      input: { toUserId: creditor, amount: 40, currencyCode: "INR" } });
    expect(result.settlement).toMatchObject({ amount: 40, status: "PENDING" });
  });

  test("rejects an amount above the outstanding balance", async () => {
    await expect(service.create({ itineraryId, userId: debtor,
      input: { toUserId: creditor, amount: 60, currencyCode: "INR" } }))
      .rejects.toMatchObject({ code: "ITINERARY.EXPENSE_SETTLEMENT_INVALID" });
  });

  test("only applies an authorized pending transition", async () => {
    repository.findById.mockResolvedValue({ id: "settlement" });
    repository.resolve.mockResolvedValue({ id: "settlement", trip_id: tripId,
      from_user_id: debtor, to_user_id: creditor, amount: "40.00",
      currency_code: "INR", status: "CONFIRMED", created_by: debtor,
      resolved_by: creditor });
    const result = await service.update({ itineraryId, settlementId: "settlement",
      userId: creditor, status: "CONFIRMED" });
    expect(result.settlement.status).toBe("CONFIRMED");
  });
});
