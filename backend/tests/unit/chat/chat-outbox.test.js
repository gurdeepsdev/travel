import { jest } from "@jest/globals";
const query = jest.fn(),
  recipients = jest.fn(),
  emit = jest.fn(),
  log = jest.fn();
const record = jest.fn();
let journalCommitted = false;
jest.unstable_mockModule(
  "../../../src/modules/chat/chat-events.service.js",
  () => ({ recordUserEventBatch: record }),
);
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: {
    transaction: async (fn) => {
      const result = await fn({ query });
      journalCommitted = true;
      return result;
    },
  },
}));
jest.unstable_mockModule(
  "../../../src/modules/chat/chat.repository.js",
  () => ({ default: { recipients } }),
);
jest.unstable_mockModule("../../../src/realtime/realtime-server.js", () => ({
  emitUserEvent: emit,
}));
jest.unstable_mockModule("../../../src/core/logger/logger.js", () => ({
  default: { error: log },
}));
const { processChatEvents } =
  await import("../../../src/realtime/chat-outbox.worker.js");
beforeEach(() => {
  jest.resetAllMocks();
  journalCommitted = false;
  recipients.mockResolvedValue([{ user_id: "active" }]);
  record.mockResolvedValue([
    {
      userId: "active",
      payload: {
        eventId: "1",
        replayCursor: "1",
        conversationId: "c",
        messageId: "m",
        type: "message.created",
      },
    },
  ]);
});
test("emits only IDs after checking current access; never emits content", async () => {
  emit.mockImplementation(() => expect(journalCommitted).toBe(true));
  query
    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({
      rows: [
        {
          id: "1",
          conversation_id: "c",
          message_id: "m",
          event_type: "message.created",
        },
      ],
    })
    .mockResolvedValue({ rows: [] });
  await processChatEvents();
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith("active", "chat.updated", {
    eventId: "1",
    replayCursor: "1",
    conversationId: "c",
    messageId: "m",
    type: "message.created",
  });
  expect(
    query.mock.calls.some(([sql]) =>
      sql.includes("processed_at=CURRENT_TIMESTAMP"),
    ),
  ).toBe(true);
});
test("failed emission leaves the event unprocessed for retry", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({
      rows: [{ id: "1", conversation_id: "c", message_id: "m" }],
    })
    .mockResolvedValue({ rows: [] });
  emit.mockImplementation(() => {
    throw Error("Unavailable");
  });
  await processChatEvents();
  expect(
    query.mock.calls.some(([sql]) =>
      sql.includes("processed_at=CURRENT_TIMESTAMP"),
    ),
  ).toBe(false);
  expect(log).toHaveBeenCalled();
});
test("missing migration does not log repeatedly", async () => {
  query.mockRejectedValue(Object.assign(Error("missing"), { code: "42P01" }));
  await processChatEvents();
  expect(log).not.toHaveBeenCalled();
});
test("journal failure does not emit a cursor or mark the event processed", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({
      rows: [{ id: "1", conversation_id: "c", message_id: "m" }],
    })
    .mockResolvedValue({ rows: [] });
  record.mockRejectedValue(new Error("journal unavailable"));
  await processChatEvents();
  expect(emit).not.toHaveBeenCalled();
  expect(
    query.mock.calls.some(([sql]) =>
      sql.includes("processed_at=CURRENT_TIMESTAMP"),
    ),
  ).toBe(false);
});
test("post-commit revocation suppresses live delivery", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ acquired: true }] })
    .mockResolvedValueOnce({ rows: [{ id: "1", conversation_id: "c" }] })
    .mockResolvedValue({ rows: [] });
  recipients
    .mockResolvedValueOnce([{ user_id: "active" }])
    .mockResolvedValueOnce([]);
  await processChatEvents();
  expect(record).toHaveBeenCalled();
  expect(emit).not.toHaveBeenCalled();
});
