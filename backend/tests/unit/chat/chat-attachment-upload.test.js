import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { chatVideoFormats, createChatVideoFixture } from "../../helpers/chat-video-fixture.js";
const authorize = jest.fn(),
  query = jest.fn(),
  store = jest.fn(),
  remove = jest.fn(),
  resolve = jest.fn();
const scan = jest.fn();
const enqueue = jest.fn();
jest.unstable_mockModule("../../../src/modules/chat/chat-media.queue.js", () => ({ enqueueChatMedia: enqueue }));
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
    expect.objectContaining({ isPublic: false, dedupScope: "chat_private" }),
  );
  expect(enqueue).not.toHaveBeenCalled();
});
test.each([false,true])("image upload schedules optimization; enqueue failure=%s still returns original",async failed=>{
  store.mockResolvedValue({storageKey:"chat/image.png",storageProvider:"local",bucket:"local"});
  resolve.mockResolvedValue({assets:[{id:"image",mime_type:"image/png",file_size:68,
    storage_provider:"local",storage_key:"chat/image.png",processing_status:"READY"}],
    unusedStoredObjects:[],supersededStoredObjects:[]});
  if(failed)enqueue.mockRejectedValue(Error("Redis unavailable"));
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZAAAAABJRU5ErkJggg==","base64");
  const result=await request(app).post("/upload").attach("attachment",png,{filename:"image.png",contentType:"image/png"});
  expect(result.status).toBe(200);expect(enqueue).toHaveBeenCalledWith("image");
  expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO chat.asset_optimizations"),["image"]);
  expect(result.body.data.asset.id).toBe("image");
});
test.each(chatVideoFormats)("real %s upload is signature-detected as %s and queues private optimization",async(extension,mimeType)=>{
  const directory=mkdtempSync("/tmp/artictern-chat-format-");
  try {
    const file=`${directory}/sample.${extension}`;createChatVideoFixture(file,extension);
    store.mockResolvedValue({storageKey:`chat/test.${extension}`,storageProvider:"local",bucket:"local"});
    resolve.mockResolvedValue({assets:[{id:"video",mime_type:mimeType,file_size:100,
      storage_provider:"local",storage_key:`chat/test.${extension}`,processing_status:"READY"}],
      unusedStoredObjects:[],supersededStoredObjects:[]});
    const result=await request(app).post("/upload").attach("attachment",readFileSync(file),{
      filename:"renamed.bin",contentType:"application/octet-stream",
    });
    expect(result.status).toBe(200);
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({dedupScope:"chat_private",isPublic:false,
      uploads:[expect.objectContaining({mimeType,extension})]}));
    expect(scan).toHaveBeenCalledTimes(1);expect(enqueue).toHaveBeenCalledWith("video");
  }finally{rmSync(directory,{recursive:true,force:true});}
},30000);
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
