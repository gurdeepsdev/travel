import { jest } from "@jest/globals";

const transactionMock = jest.fn();

jest.unstable_mockModule(
  "../../../src/database/database-manager.js",
  () => ({
    default: {
      transaction: transactionMock,
    },
  }),
);

const { default: repository } = await import(
  "../../../src/modules/groups/groups.repository.js"
);

describe("GroupsRepository.unlinkItinerary", () => {
  const groupId = "6a969885-7892-4271-9849-e44621e89d13";
  const itineraryId = "6590a09a-4667-4ed0-ab8c-a5507c0805bd";
  const userId = "1a5ae58e-8931-44ce-8385-61996f7e46e7";
  const group = { id: groupId, itinerary_id: itineraryId, owner_id: userId };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(repository, "lockGroup").mockResolvedValue(group);
  });

  const run = async (ledger) => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [ledger] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...group, itinerary_id: null }] }),
    };
    transactionMock.mockImplementation((callback) => callback(client));
    return { result: await repository.unlinkItinerary({ groupId, userId }), client };
  };

  test.each([
    [{ has_active_expenses: true, has_open_balance: true, has_pending_settlement: false }],
    [{ has_active_expenses: true, has_open_balance: false, has_pending_settlement: true }],
  ])("blocks unresolved active expenses", async (ledger) => {
    const { result, client } = await run(ledger);
    expect(result).toEqual({ financialHistory: true });
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ has_active_expenses: true, has_open_balance: false, has_pending_settlement: false }],
    [{ has_active_expenses: false, has_open_balance: true, has_pending_settlement: true }],
  ])("allows settled or deleted expenses", async (ledger) => {
    const { result, client } = await run(ledger);
    expect(result).toMatchObject({ updated: true, itineraryId });
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0][0]).toContain("expense.deleted_at IS NULL");
    expect(client.query.mock.calls[0][0]).toContain("settlement.status = 'CONFIRMED'");
  });
});
