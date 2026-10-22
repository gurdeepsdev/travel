import { jest } from "@jest/globals";
const add=jest.fn(),query=jest.fn();
jest.unstable_mockModule("bullmq",()=>({Queue:class{add(...args){return add(...args);}}}));
jest.unstable_mockModule("../../../src/database/database-manager.js",()=>({default:{query}}));
jest.unstable_mockModule("../../../src/modules/media/video-processing.queue.js",()=>({connection:{host:"test"}}));
const {enqueueChatMedia,recoverChatMedia,CHAT_MEDIA_JOB}=await import("../../../src/modules/chat/chat-media.queue.js");
beforeEach(()=>jest.resetAllMocks());
test("private optimization uses stable job IDs, bounded retries and the serial video queue",async()=>{
  await enqueueChatMedia("asset");
  expect(add).toHaveBeenCalledWith(CHAT_MEDIA_JOB,{assetId:"asset"},expect.objectContaining({
    jobId:"chat-media-asset",attempts:3,backoff:{type:"exponential",delay:5000},
  }));
});
test("recovery re-enqueues pending private chat work only",async()=>{
  query.mockResolvedValue({rows:[{asset_id:"one"},{asset_id:"two"}]});
  await recoverChatMedia();
  expect(query.mock.calls[0][0]).toContain("o.status='PENDING'");
  expect(query.mock.calls[0][0]).toContain("a.dedup_scope='chat_private'");
  expect(query.mock.calls[0][0]).toContain("a.deleted_at IS NULL");
  expect(add).toHaveBeenCalledTimes(2);
});
test("queue failure is propagated so upload can defer safely to recovery",async()=>{
  add.mockRejectedValue(Error("Redis unavailable"));
  await expect(enqueueChatMedia("asset")).rejects.toThrow("Redis unavailable");
});
