import { jest } from "@jest/globals";
const repository = { create: jest.fn(), access: jest.fn(), respond: jest.fn() };
jest.unstable_mockModule(
  "../../../src/modules/chat/chat.repository.js",
  () => ({ default: repository }),
);
const { default: service, mapConversation } =
  await import("../../../src/modules/chat/chat.service.js");
const { createConversationSchema, respondConversationSchema } =
  await import("../../../src/modules/chat/chat.validation.js");
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => jest.clearAllMocks());

test.each(["direct", "group", "community"])(
  "maps %s without exposing internal direct key",
  (type) => {
    const result = mapConversation({
      id,
      conversation_type: type,
      request_status: "ACCEPTED",
      can_send: true,
      direct_key: "secret",
    });
    expect(result).toMatchObject({ id, type, canSend: true });
    expect(result).not.toHaveProperty("direct_key");
  },
);
test.each(["PENDING", "REJECTED"])(
  "cannot send in %s requests",
  (request_status) => {
    expect(mapConversation({ request_status, can_send: true }).canSend).toBe(
      false,
    );
  },
);
test("community non-admin cannot send", () => {
  expect(
    mapConversation({ request_status: "ACCEPTED", can_send: false }).canSend,
  ).toBe(false);
});
test("unavailable conversation is hidden", async () => {
  repository.access.mockResolvedValue(null);
  await expect(service.get(id, id)).rejects.toMatchObject({
    code: "CHAT.CONVERSATION_NOT_FOUND",
    statusCode: 404,
  });
});
test("conflicting request decision is rejected", async () => {
  repository.respond.mockResolvedValue({ conflict: true });
  await expect(service.respond(id, id, "ACCEPTED")).rejects.toMatchObject({
    statusCode: 409,
  });
});
test("successful decision refreshes permissions", async () => {
  repository.respond.mockResolvedValue({ id, request_status: "ACCEPTED" });
  repository.access.mockResolvedValue({
    id,
    request_status: "ACCEPTED",
    can_send: true,
  });
  expect((await service.respond(id, id, "ACCEPTED")).conversation.canSend).toBe(
    true,
  );
});
test.each([
  { type: "direct", userId: id },
  { type: "group", groupId: id },
  { type: "community", communityId: id },
])("accepts exactly one conversation target", (body) => {
  expect(
    createConversationSchema.safeParse({ params: {}, query: {}, body }).success,
  ).toBe(true);
});
test("rejects ambiguous targets", () => {
  expect(
    createConversationSchema.safeParse({
      params: {},
      query: {},
      body: { type: "direct", userId: id, groupId: id },
    }).success,
  ).toBe(false);
});
test("rejects an unsupported request decision", () => {
  expect(
    respondConversationSchema.safeParse({
      params: { conversationId: id },
      query: {},
      body: { status: "PENDING" },
    }).success,
  ).toBe(false);
});
