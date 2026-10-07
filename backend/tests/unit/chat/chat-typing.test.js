import { jest } from "@jest/globals";
const query = jest.fn(),
  authorize = jest.fn();
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: { transaction: (fn) => fn({ query }) },
}));
jest.unstable_mockModule(
  "../../../src/modules/chat/chat-messages.service.js",
  () => ({ authorize }),
);
const { registerChatTyping } =
  await import("../../../src/modules/chat/chat-typing.js");
const conversationId = "2594bbbb-c582-4037-9a5f-ea65ba9e3285";
let handler, authenticate, redis, emit, reply;
beforeEach(() => {
  jest.resetAllMocks();
  authenticate = jest.fn().mockResolvedValue({ user: { id: "sender" } });
  redis = { set: jest.fn().mockResolvedValue("OK") };
  emit = jest.fn();
  reply = jest.fn();
  registerChatTyping(
    {
      data: { userId: "sender" },
      on: (_, fn) => {
        handler = fn;
      },
    },
    { authenticate, redis, emit },
  );
  query.mockResolvedValue({ rows: [{ id: "recipient" }] });
});
test("typing checks current authentication and send permission and emits metadata only", async () => {
  await handler({ conversationId, isTyping: true }, reply);
  expect(authorize).toHaveBeenCalledWith(
    expect.anything(),
    conversationId,
    "sender",
    true,
  );
  expect(emit).toHaveBeenCalledWith(
    "recipient",
    "chat.typing",
    expect.objectContaining({
      conversationId,
      userId: "sender",
      isTyping: true,
    }),
  );
  expect(reply).toHaveBeenCalledWith({ success: true });
});
test("expired authentication does not emit", async () => {
  authenticate.mockRejectedValue(new Error("expired"));
  await handler({ conversationId, isTyping: true }, reply);
  expect(emit).not.toHaveBeenCalled();
});
test("rate limiting and denied membership do not emit", async () => {
  redis.set.mockResolvedValue(null);
  await handler({ conversationId, isTyping: true }, reply);
  expect(authorize).not.toHaveBeenCalled();
  redis.set.mockResolvedValue("OK");
  authorize.mockRejectedValue(new Error("removed"));
  await handler({ conversationId, isTyping: true }, reply);
  expect(emit).not.toHaveBeenCalled();
});
