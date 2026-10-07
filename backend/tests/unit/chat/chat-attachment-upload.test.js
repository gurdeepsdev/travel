import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
const authorize = jest.fn(),
  query = jest.fn(),
  store = jest.fn(),
  remove = jest.fn(),
  resolve = jest.fn();
const scan = jest.fn();
jest.unstable_mockModule(
  "../../../src/modules/chat/chat-malware.service.js",
  () => ({ scanChatAttachment: scan }),
);
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: { query, transaction: (fn) => fn({ query }) },
}));
jest.unstable_mockModule(
  "../../../src/modules/chat/chat-messages.service.js",
  () => ({ authorize }),
);
jest.unstable_mockModule(
  "../../../src/providers/storage/storage-manager.js",
  () => ({ default: { store, remove } }),
);
jest.unstable_mockModule(
  "../../../src/modules/media/media.repository.js",
  () => ({ default: { resolveUploadedAssets: resolve } }),
);
const { uploadChatAttachment } =
  await import("../../../src/modules/chat/chat-attachment-upload.js");
const app = express();
app.post(
  "/upload",
  (req, res, next) => {
    req.user = { id: "user" };
    req.validated = { params: { conversationId: "conversation" } };
    next();
  },
  uploadChatAttachment,
);
app.use((error, req, res, next) =>
  res.status(error.statusCode ?? 500).json({ code: error.code }),
);
beforeEach(() => {
  jest.resetAllMocks();
  authorize.mockResolvedValue({});
  query.mockResolvedValue({ rows: [] });
  scan.mockResolvedValue();
});
test("rejects disguised files using file signatures", async () => {
  const result = await request(app)
    .post("/upload")
    .attach("attachment", Buffer.from("<script>bad</script>"), {
      filename: "photo.jpg",
      contentType: "image/jpeg",
    });
  expect(result.status).toBe(415);
  expect(store).not.toHaveBeenCalled();
});
test("uploads a private PDF and returns no storage keys", async () => {
  store.mockResolvedValue({
    storageKey: "chat/test.pdf",
    storageProvider: "local",
    bucket: "local",
  });
  resolve.mockResolvedValue({
    assets: [
      {
        id: "asset",
        mime_type: "application/pdf",
        file_size: 32,
        storage_provider: "local",
        storage_key: "chat/test.pdf",
        processing_status: "READY",
      },
    ],
    unusedStoredObjects: [],
    supersededStoredObjects: [],
  });
  const result = await request(app)
    .post("/upload")
    .attach("attachment", Buffer.from("%PDF-1.4\nhello document\n%%EOF"), {
      filename: "document.pdf",
      contentType: "application/pdf",
    });
  expect(result.status).toBe(200);
  expect(result.body.data.asset).toEqual({
    id: "asset",
    mimeType: "application/pdf",
    fileSize: 32,
  });
  expect(resolve).toHaveBeenCalledWith(
    expect.objectContaining({ isPublic: false }),
  );
});
test("persistence errors clean stored files", async () => {
  store.mockResolvedValue({ storageKey: "chat/test.pdf" });
  resolve.mockRejectedValue(Error("DB failed"));
  const result = await request(app)
    .post("/upload")
    .attach("attachment", Buffer.from("%PDF-1.4\nhello document\n%%EOF"), {
      filename: "document.pdf",
    });
  expect(result.status).toBe(500);
  expect(remove).toHaveBeenCalledWith({ storageKey: "chat/test.pdf" });
});
test.each([
  [422, "CHAT.ATTACHMENT_MALWARE_DETECTED"],
  [503, "CHAT.MALWARE_SCAN_UNAVAILABLE"],
])("scan failure %s blocks storage and persistence", async (status, code) => {
  scan.mockRejectedValue(
    Object.assign(new Error("blocked"), { statusCode: status, code }),
  );
  const response = await request(app)
    .post("/upload")
    .attach("attachment", Buffer.from("%PDF-1.4\nhello\n%%EOF"), {
      filename: "file.pdf",
    });
  expect(response.status).toBe(status);
  expect(response.body.code).toBe(code);
  expect(store).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
});
