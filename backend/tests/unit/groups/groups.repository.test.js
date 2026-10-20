import { jest } from "@jest/globals";

const transactionMock = jest.fn();
const publishNotice = jest.fn().mockResolvedValue();
jest.unstable_mockModule('../../../src/modules/groups/group-chat-notices.service.js',()=>({publishGroupNotice:publishNotice}));

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

describe('GroupsRepository.createLinked conversation creation', () => {
  const ownerId = '1a5ae58e-8931-44ce-8385-61996f7e46e7';
  const group = { id: '6a969885-7892-4271-9849-e44621e89d13' };
  test('uses the same transaction client for group and conversation', async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [group] }).mockResolvedValueOnce({ rows: [] }) };
    await expect(repository.createLinked({ client, itineraryId: null, ownerId, name: 'New group' })).resolves.toBe(group);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][0]).toContain('ON CONFLICT(group_id) DO NOTHING');
    expect(client.query.mock.calls[1][1]).toEqual([group.id]);
    expect(publishNotice).toHaveBeenCalledWith(client,expect.objectContaining({type:'GROUP_CREATED',groupId:group.id,actorId:ownerId}));
  });
  test('conversation failure fails group creation instead of returning success', async () => {
    const error = new Error('Conversation insert failed');
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [group] }).mockRejectedValueOnce(error) };
    transactionMock.mockImplementation(callback => callback(client));
    await expect(repository.createStandaloneGroup({ userId: ownerId, input: { name: 'New group' } })).rejects.toBe(error);
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});

describe("GroupsRepository.unlinkItinerary", () => {
  const groupId = "6a969885-7892-4271-9849-e44621e89d13";
  const itineraryId = "6590a09a-4667-4ed0-ab8c-a5507c0805bd";
  const userId = "1a5ae58e-8931-44ce-8385-61996f7e46e7";
  const group = { id: groupId, itinerary_id: itineraryId, owner_id: userId };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(repository, "lockGroup").mockResolvedValue(group);
    jest.spyOn(repository, "isAdmin").mockResolvedValue(true);
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
    expect(publishNotice).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ has_active_expenses: true, has_open_balance: false, has_pending_settlement: false }],
    [{ has_active_expenses: false, has_open_balance: true, has_pending_settlement: true }],
  ])("allows settled or deleted expenses", async (ledger) => {
    const { result, client } = await run(ledger);
    expect(result).toMatchObject({ updated: true, itineraryId });
    expect(publishNotice).toHaveBeenCalledWith(client,expect.objectContaining({type:'ITINERARY_UNLINKED',groupId,itineraryId,actorId:userId}));
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[0][0]).toContain("expense.deleted_at IS NULL");
    expect(client.query.mock.calls[0][0]).toContain("settlement.status = 'CONFIRMED'");
  });
});

describe('GroupsRepository.updateGroup notices',()=>{
  const groupId='6a969885-7892-4271-9849-e44621e89d13', userId='1a5ae58e-8931-44ce-8385-61996f7e46e7';
  beforeEach(()=>{jest.clearAllMocks();jest.spyOn(repository,'isAdmin').mockResolvedValue(true);});
  test.each([false,true])('name-change notice occurs only for an actual change: %s',async changed=>{
    const original={id:groupId,name:'Original',description:null,cover_asset_id:null};
    jest.spyOn(repository,'lockGroup').mockResolvedValue(original);
    const updated={...original,name:changed?'Updated':'Original'};
    const client={query:jest.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[updated]}).mockResolvedValue({rows:[]})};
    transactionMock.mockImplementation(fn=>fn(client));
    await repository.updateGroup({groupId,userId,input:{name:updated.name}});
    expect(publishNotice).toHaveBeenCalledTimes(changed?1:0);
    if(changed)expect(publishNotice).toHaveBeenCalledWith(client,expect.objectContaining({type:'GROUP_NAME_CHANGED',groupName:'Updated',previousName:'Original'}));
  });
});
