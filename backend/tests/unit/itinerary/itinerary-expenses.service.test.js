import { jest } from "@jest/globals";

const repositoryMock = {
  findAccessibleTrip: jest.fn(),
  findActiveParticipantIds: jest.fn(),
  receiptBelongsToUser: jest.fn(),
  create: jest.fn(),
  list: jest.fn(),
  findById: jest.fn(),
  findEditable: jest.fn(),
  update: jest.fn(),
  replaceSplits: jest.fn(),
  softDelete: jest.fn(),
  getSummary: jest.fn(),
  getBalances: jest.fn(),
};
jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-expenses.repository.js",
  () => ({ default: repositoryMock }),
);
const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-expenses.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const tripId = "22222222-2222-4222-8222-222222222222";
const userA = "33333333-3333-4333-8333-333333333333";
const userB = "44444444-4444-4444-8444-444444444444";
const baseInput = {
  paidBy: userA,
  category: "FOOD",
  title: "Dinner",
  amount: 100,
  currencyCode: "INR",
  paymentMethod: "UPI",
  expenseDate: "2026-09-09",
  splitType: "EQUAL",
  participants: [{ userId: userA }, { userId: userB }],
};

describe("ItineraryExpensesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryMock.findAccessibleTrip.mockResolvedValue({ trip_id: tripId });
    repositoryMock.findActiveParticipantIds.mockResolvedValue([userA, userB]);
    repositoryMock.create.mockImplementation(async ({ input, splits, createdBy }) => ({
      expense: {
        id: "55555555-5555-4555-8555-555555555555",
        trip_id: tripId, paid_by: input.paidBy, created_by: createdBy,
        expense_category: input.category, title: input.title,
        description: null, amount: input.amount, currency_code: input.currencyCode,
        payment_method: input.paymentMethod, expense_date: input.expenseDate,
        receipt_asset_id: null, location_name: null, split_type: input.splitType,
        created_at: "2026-09-09T10:00:00.000Z",
        updated_at: "2026-09-09T10:00:00.000Z",
      },
      splits: splits.map((split, index) => ({
        id: `${index + 6}5555555-5555-4555-8555-555555555555`,
        user_id: split.userId, amount: split.amount,
        percentage: split.percentage, settlement_status: "PENDING",
      })),
    }));
  });

  test("creates equal splits atomically", async () => {
    const result = await service.createExpense({ itineraryId, userId: userA, input: baseInput });
    expect(result.expense.splits.map((split) => split.amount)).toEqual([50, 50]);
    expect(repositoryMock.create).toHaveBeenCalledTimes(1);
  });

  test("lists expenses with viewer state and pagination", async () => {
    repositoryMock.list.mockResolvedValue({
      rows: [{
        id: "55555555-5555-4555-8555-555555555555",
        trip_id: tripId, paid_by: userA, created_by: userA,
        payer_username: "payer", payer_display_name: "Payer",
        payer_photo_id: null, creator_username: "payer",
        creator_display_name: "Payer", expense_category: "FOOD",
        title: "Dinner", description: null, amount: "100.00",
        currency_code: "INR", payment_method: "UPI",
        expense_date: "2026-09-09", location_name: null,
        split_type: "EQUAL", receipt_asset_id: null,
        splits: [{ id: "split", userId: userA, amount: 50,
          percentage: null, settlementStatus: "PENDING" }],
        viewer_share: "50.00", created_at: "2026-09-09T10:00:00.000Z",
        updated_at: "2026-09-09T10:00:00.000Z",
      }],
      hasMore: false,
      lastRow: null,
    });

    const result = await service.listExpenses({
      itineraryId, userId: userA, limit: 20, cursor: null,
    });
    expect(result.expenses[0].viewerState).toEqual({
      paidAmount: 100, shareAmount: 50, netAmount: 50,
    });
    expect(result.pagination).toEqual({ hasMore: false, nextCursor: null });
  });

  test("gets one expense from the requested itinerary", async () => {
    repositoryMock.findById.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      trip_id: tripId, paid_by: userA, created_by: userA,
      payer_username: "payer", payer_display_name: "Payer",
      payer_photo_id: null, creator_username: "payer",
      creator_display_name: "Payer", expense_category: "FOOD",
      title: "Dinner", description: null, amount: "100.00",
      currency_code: "INR", payment_method: "UPI",
      expense_date: "2026-09-09", location_name: null,
      split_type: "EQUAL", receipt_asset_id: null,
      splits: [], viewer_share: "50.00",
      created_at: "2026-09-09T10:00:00.000Z",
      updated_at: "2026-09-09T10:00:00.000Z",
    });

    const result = await service.getExpense({
      itineraryId,
      expenseId: "55555555-5555-4555-8555-555555555555",
      userId: userA,
    });
    expect(result.expense).toMatchObject({
      title: "Dinner",
      viewerState: { paidAmount: 100, shareAmount: 50, netAmount: 50 },
    });
  });

  test("returns expense not found for a mismatched expense", async () => {
    repositoryMock.findById.mockResolvedValue(null);
    await expect(service.getExpense({
      itineraryId,
      expenseId: "55555555-5555-4555-8555-555555555555",
      userId: userA,
    })).rejects.toMatchObject({
      code: "ITINERARY.EXPENSE_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("updates expense metadata without changing splits", async () => {
    repositoryMock.findEditable.mockResolvedValue({
      resolved_trip_id: tripId,
    });
    repositoryMock.update.mockResolvedValue({ id: "expense" });
    repositoryMock.findById.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      trip_id: tripId, paid_by: userA, created_by: userA,
      payer_username: "payer", payer_display_name: "Payer",
      payer_photo_id: null, creator_username: "payer",
      creator_display_name: "Payer", expense_category: "FOOD",
      title: "Updated dinner", description: null, amount: "100.00",
      currency_code: "INR", payment_method: "UPI",
      expense_date: "2026-09-09", location_name: null,
      split_type: "EQUAL", receipt_asset_id: null,
      splits: [], viewer_share: "50.00",
      created_at: "2026-09-09T10:00:00.000Z",
      updated_at: "2026-09-09T11:00:00.000Z",
    });

    const result = await service.updateExpense({
      itineraryId,
      expenseId: "55555555-5555-4555-8555-555555555555",
      userId: userA,
      input: { title: "Updated dinner", description: null },
    });
    expect(repositoryMock.update).toHaveBeenCalledWith({
      expenseId: "55555555-5555-4555-8555-555555555555",
      input: { title: "Updated dinner", description: null },
    });
    expect(result.expense.title).toBe("Updated dinner");
  });

  test("rejects editing by an unauthorized participant", async () => {
    repositoryMock.findEditable.mockResolvedValue(null);
    await expect(service.updateExpense({
      itineraryId,
      expenseId: "55555555-5555-4555-8555-555555555555",
      userId: userB,
      input: { title: "No access" },
    })).rejects.toMatchObject({
      code: "ITINERARY.EXPENSE_NOT_FOUND",
      statusCode: 404,
    });
  });

  test("assigns an equal-split rounding remainder deterministically", () => {
    const splits = service.calculateSplits({
      ...baseInput, amount: 10,
      participants: [{ userId: userA }, { userId: userB },
        { userId: "66666666-6666-4666-8666-666666666666" }],
    });
    expect(splits.map((split) => split.amount)).toEqual(["3.34", "3.33", "3.33"]);
  });

  test("validates exact and percentage totals", () => {
    expect(() => service.calculateSplits({
      ...baseInput, splitType: "EXACT",
      participants: [{ userId: userA, amount: 20 }, { userId: userB, amount: 20 }],
    })).toThrow("Exact split amounts must equal");
    expect(() => service.calculateSplits({
      ...baseInput, splitType: "PERCENTAGE",
      participants: [{ userId: userA, percentage: 60 }, { userId: userB, percentage: 30 }],
    })).toThrow("Split percentages must total exactly 100");
  });

  test("rejects inactive payer or split users", async () => {
    repositoryMock.findActiveParticipantIds.mockResolvedValue([userA]);
    await expect(service.createExpense({ itineraryId, userId: userA, input: baseInput }))
      .rejects.toMatchObject({ code: "ITINERARY.EXPENSE_PARTICIPANT_INVALID" });
  });

  test("rejects inaccessible itinerary trips", async () => {
    repositoryMock.findAccessibleTrip.mockResolvedValue(null);
    await expect(service.createExpense({ itineraryId, userId: userA, input: baseInput }))
      .rejects.toMatchObject({ code: "ITINERARY.NOT_FOUND", statusCode: 404 });
  });

  test("replaces expense amount and splits", async () => {
    repositoryMock.findEditable.mockResolvedValue({ resolved_trip_id: tripId });
    repositoryMock.replaceSplits.mockResolvedValue({});
    repositoryMock.findById.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555", trip_id: tripId,
      paid_by: userA, created_by: userA, amount: "120.00", currency_code: "INR",
      payer_username: "payer", payer_display_name: "Payer", payer_photo_id: null,
      creator_username: "payer", creator_display_name: "Payer", expense_category: "FOOD",
      title: "Dinner", payment_method: "UPI", split_type: "EQUAL", splits: [],
      viewer_share: "60.00",
    });
    await service.replaceExpenseSplits({ itineraryId,
      expenseId: "55555555-5555-4555-8555-555555555555", userId: userA,
      input: { amount: 120, splitType: "EQUAL",
        participants: [{ userId: userA }, { userId: userB }] } });
    expect(repositoryMock.replaceSplits).toHaveBeenCalledWith(expect.objectContaining({
      amount: 120, splitType: "EQUAL",
    }));
  });

  test("soft deletes an editable expense", async () => {
    repositoryMock.findEditable.mockResolvedValue({ resolved_trip_id: tripId });
    repositoryMock.softDelete.mockResolvedValue({ id: "expense", deleted_at: "now" });
    await expect(service.deleteExpense({ itineraryId, expenseId: "expense", userId: userA }))
      .resolves.toEqual({ deleted: true, expenseId: "expense", deletedAt: "now" });
  });

  test("returns dashboard totals and balances", async () => {
    repositoryMock.getSummary.mockResolvedValue({ expense_count: 2,
      totals: [{ currencyCode: "INR", totalAmount: "120.00", categories: { FOOD: 120 } }] });
    repositoryMock.getBalances.mockResolvedValue([{ user_id: userA, username: "payer",
      display_name: "Payer", currency_code: "INR", paid_amount: "120.00",
      share_amount: "60.00", net_amount: "60.00" }]);
    const result = await service.getDashboard({ itineraryId, userId: userA });
    expect(result).toMatchObject({ expenseCount: 2,
      totals: [{ currencyCode: "INR", totalAmount: 120 }],
      balances: [{ netAmount: 60 }] });
  });
});
