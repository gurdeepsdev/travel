import { jest } from "@jest/globals";

const repositoryMock = {
  createStandaloneGroup: jest.fn(),
  linkItinerary: jest.fn(),
  removeMember: jest.fn(),
  listInvitations: jest.fn(),
  respondToInvitation: jest.fn(),
  createInvitation: jest.fn(),
  createLinkedGroup: jest.fn(),
  findAccessibleLinkedGroup: jest.fn(),
  listActiveMembers: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/groups/groups.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: service } = await import(
  "../../../src/modules/groups/groups.service.js"
);

const itineraryId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const groupId = "33333333-3333-4333-8333-333333333333";

describe("GroupsService", () => {
  test('creates a standalone group with a null itinerary', async () => {
    repositoryMock.createStandaloneGroup.mockResolvedValue({id:groupId,itinerary_id:null,owner_id:userId});
    await expect(service.createStandaloneGroup({userId,input:{name:'Trip'}}))
      .resolves.toMatchObject({created:true,group:{id:groupId,itineraryId:null,ownerId:userId}});
  });
  test.each([[null,404],[{conflict:true},409]])('rejects unavailable or conflicting link', async (result,statusCode) => {
    repositoryMock.linkItinerary.mockResolvedValue(result);
    await expect(service.linkItinerary({userId,groupId,itineraryId})).rejects.toMatchObject({statusCode});
  });
  test.each([true,false])('maps link updated=%s', async updated => {
    repositoryMock.linkItinerary.mockResolvedValue({updated,group:{id:groupId,itinerary_id:itineraryId}});
    await expect(service.linkItinerary({userId,groupId,itineraryId}))
      .resolves.toMatchObject({updated,group:{id:groupId,itineraryId}});
  });
  test.each([
    [null, 'GROUP.MEMBER_NOT_FOUND', 404],
    [{error:'OWNER_REMOVAL_FORBIDDEN'}, 'GROUP.OWNER_REMOVAL_FORBIDDEN', 409],
  ])('maps membership removal failures', async (result, code, statusCode) => {
    repositoryMock.removeMember.mockResolvedValue(result);
    await expect(service.removeMember({itineraryId,userId,leave:true}))
      .rejects.toMatchObject({code,statusCode});
  });

  test.each([true,false])('returns removal updated=%s', async (updated) => {
    const result={updated,status:'REMOVED',userId,groupId,itineraryId};
    repositoryMock.removeMember.mockResolvedValue(result);
    await expect(service.removeMember({itineraryId,userId,leave:true})).resolves.toEqual(result);
  });

  test.each([
    [null, 'GROUP.INVITATION_NOT_FOUND', 404],
    [{error:'CONNECTION_REQUIRED'}, 'GROUP.CONNECTION_REQUIRED', 403],
    [{error:'INVITATION_EXPIRED'}, 'GROUP.INVITATION_EXPIRED', 409],
    [{error:'INVITATION_RESOLVED'}, 'GROUP.INVITATION_RESOLVED', 409],
  ])('maps response failures', async (value, code, statusCode) => {
    repositoryMock.respondToInvitation.mockResolvedValue(value);
    await expect(service.respondToInvitation({invitationId:groupId,userId,status:'ACCEPTED'}))
      .rejects.toMatchObject({code,statusCode});
  });

  test('paginates received invitations and maps effective expiry', async () => {
    const row = {id:groupId, created_at:new Date('2026-09-10T00:00:00Z'),
      status:'PENDING',effective_status:'EXPIRED'};
    repositoryMock.listInvitations.mockResolvedValue([row,row]);
    const result = await service.listInvitations({userId,limit:1});
    expect(result.invitations).toHaveLength(1);
    expect(result.invitations[0].status).toBe('EXPIRED');
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toEqual(expect.any(String));
    await expect(service.listInvitations({userId,cursor:'bad'})).rejects.toMatchObject({statusCode:400});
  });

  test.each([true,false])('returns invitation decision updated=%s', async (updated) => {
    repositoryMock.respondToInvitation.mockResolvedValue({updated,invitation:{id:groupId,status:'ACCEPTED'}});
    await expect(service.respondToInvitation({userId,invitationId:groupId,status:'ACCEPTED'}))
      .resolves.toMatchObject({updated,invitation:{id:groupId,status:'ACCEPTED'}});
  });

  const targetId = "44444444-4444-4444-8444-444444444444";
  test("rejects self invitations before repository access", async () => {
    await expect(service.createInvitation({ itineraryId, userId, input: { userId } }))
      .rejects.toMatchObject({ code: "GROUP.SELF_INVITATION", statusCode: 400 });
    expect(repositoryMock.createInvitation).not.toHaveBeenCalled();
  });

  test.each([
    [null, "GROUP.NOT_FOUND", 404],
    [{ error: "CONNECTION_REQUIRED" }, "GROUP.CONNECTION_REQUIRED", 403],
    [{ error: "ALREADY_MEMBER" }, "GROUP.ALREADY_MEMBER", 409],
  ])("maps invitation access failures", async (result, code, statusCode) => {
    repositoryMock.createInvitation.mockResolvedValue(result);
    await expect(service.createInvitation({ itineraryId, userId, input: { userId: targetId } }))
      .rejects.toMatchObject({ code, statusCode });
  });

  test.each([true, false])("maps new and existing invitations: created=%s", async (created) => {
    repositoryMock.createInvitation.mockResolvedValue({ created, invitation: {
      id: targetId, group_id: groupId, invited_user_id: targetId,
      invited_by: userId, status: "PENDING", message: null,
    } });
    const result = await service.createInvitation({ itineraryId, userId, input: { userId: targetId } });
    expect(result).toMatchObject({ created, invitation: {
      groupId, itineraryId, invitedUserId: targetId, invitedBy: userId, status: "PENDING",
    } });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates and maps an owned itinerary group", async () => {
    repositoryMock.createLinkedGroup.mockResolvedValue({
      created: true,
      group: {
        id: groupId,
        itinerary_id: itineraryId,
        owner_id: userId,
        name: "Kerala trip",
        description: null,
        status: "ACTIVE",
        created_at: "2026-09-10T08:00:00.000Z",
        updated_at: "2026-09-10T08:00:00.000Z",
      },
    });

    const result = await service.createLinkedGroup({
      itineraryId,
      userId,
      input: {},
    });

    expect(repositoryMock.createLinkedGroup).toHaveBeenCalledWith({
      itineraryId,
      userId,
      input: {},
    });
    expect(result).toMatchObject({
      created: true,
      group: {
        id: groupId,
        itineraryId,
        ownerId: userId,
        status: "ACTIVE",
      },
    });
  });

  test("hides a missing or unowned itinerary", async () => {
    repositoryMock.createLinkedGroup.mockResolvedValue(null);

    await expect(service.createLinkedGroup({
      itineraryId,
      userId,
      input: {},
    })).rejects.toMatchObject({
      code: "ITINERARY.NOT_FOUND",
      statusCode: 404,
    });
  });

  test("rejects an inconsistent existing group link", async () => {
    repositoryMock.createLinkedGroup.mockResolvedValue({ conflict: true });

    await expect(service.createLinkedGroup({
      itineraryId,
      userId,
      input: {},
    })).rejects.toMatchObject({
      code: "GROUP.ITINERARY_ALREADY_LINKED",
      statusCode: 409,
    });
  });

  test("lists active members for an accessible linked group", async () => {
    repositoryMock.findAccessibleLinkedGroup.mockResolvedValue({
      id: groupId,
      itinerary_id: itineraryId,
      owner_id: userId,
      name: "Kerala trip",
      description: null,
      status: "ACTIVE",
    });
    repositoryMock.listActiveMembers.mockResolvedValue([{
      id: "44444444-4444-4444-8444-444444444444",
      user_id: userId,
      username: "owner",
      display_name: "Trip owner",
      is_verified: true,
      profile_photo_id: null,
      role: "OWNER",
      status: "ACTIVE",
      joined_at: "2026-09-10T08:00:00.000Z",
      created_at: "2026-09-10T08:00:00.000Z",
      updated_at: "2026-09-10T08:00:00.000Z",
    }]);

    const result = await service.listLinkedGroupMembers({
      itineraryId,
      userId,
    });

    expect(repositoryMock.listActiveMembers).toHaveBeenCalledWith({
      groupId,
    });
    expect(result).toMatchObject({
      totalCount: 1,
      members: [{ role: "OWNER", user: { id: userId } }],
    });
  });

  test("hides an inaccessible or missing group", async () => {
    repositoryMock.findAccessibleLinkedGroup.mockResolvedValue(null);

    await expect(service.listLinkedGroupMembers({
      itineraryId,
      userId,
    })).rejects.toMatchObject({
      code: "GROUP.NOT_FOUND",
      statusCode: 404,
    });
  });
});
