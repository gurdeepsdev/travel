import { jest } from "@jest/globals";
const query = jest.fn(),
  warn = jest.fn();
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: { transaction: (fn) => fn({ query }) },
}));
jest.unstable_mockModule("../../../src/core/logger/logger.js", () => ({
  default: { warn, error: jest.fn() },
}));
const { processChatPush, enqueueChatPush } =
  await import("../../../src/realtime/chat-push.worker.js");
const row = {
  id: 1,
  device_id: "device",
  message_id: "message",
  conversation_id: "conversation",
  attempts: 0,
};
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CHAT_PUSH_ENABLED = "true";
});
afterEach(() => {
  delete process.env.CHAT_PUSH_ENABLED;
});
test("disabled provider does not query or send", async () => {
  delete process.env.CHAT_PUSH_ENABLED;
  const send = jest.fn();
  await processChatPush(send);
  await enqueueChatPush({ query }, { event_type: "message.created" });
  expect(query).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
test("revoked or muted recipients are suppressed at dispatch", async () => {
  query
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValue({ rows: [] });
  const send = jest.fn();
  await processChatPush(send);
  expect(send).not.toHaveBeenCalled();
  expect(query).toHaveBeenLastCalledWith(
    expect.stringContaining("completed_at"),
    [1, "SUPPRESSED"],
  );
});
test("temporary delivery failures reserve retry with no secret logging", async () => {
  query
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [{}] })
    .mockResolvedValue({ rows: [] });
  await processChatPush(jest.fn().mockRejectedValue(new Error("secret token")));
  expect(query).toHaveBeenLastCalledWith(
    expect.stringContaining("next_attempt_at"),
    [1, 1, "FCM_SEND_FAILED", false, 120],
  );
  expect(warn).toHaveBeenCalledWith(
    { code: "FCM_SEND_FAILED" },
    "Chat push delivery failed.",
  );
});
test("unregistered devices are disabled and not retried", async () => {
  query
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [{}] })
    .mockResolvedValue({ rows: [] });
  await processChatPush(
    jest
      .fn()
      .mockRejectedValue({
        response: {
          data: { error: { details: [{ errorCode: "UNREGISTERED" }] } },
        },
      }),
  );
  expect(query).toHaveBeenCalledWith(expect.stringContaining("enabled=false"), [
    "device",
  ]);
  expect(query).toHaveBeenLastCalledWith(expect.any(String), [
    1,
    1,
    "UNREGISTERED",
    true,
    120,
  ]);
});
