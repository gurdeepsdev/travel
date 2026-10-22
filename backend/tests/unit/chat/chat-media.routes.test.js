import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";

const authorize = jest.fn(), preview = jest.fn();
jest.unstable_mockModule("../../../src/modules/chat/chat-messages.service.js",()=>({default:{attachment:authorize}}));
jest.unstable_mockModule("../../../src/modules/chat/chat-media.service.js",()=>({getChatPreview:preview}));
const { registerChatMediaRoutes }=await import("../../../src/modules/chat/chat-media.routes.js");
const directory=mkdtempSync("/tmp/artictern-preview-route-"),file=directory+"/preview.webp";
writeFileSync(file,Buffer.from("0123456789"));
const app=express(),router=express.Router();
app.use((req,res,next)=>{if(!req.get("Authorization"))return res.status(401).end();req.user={id:"viewer"};next();});
registerChatMediaRoutes(router);app.use(router);
app.use((error,req,res,next)=>res.status(error.statusCode??500).json({code:error.code}));
const id="550e8400-e29b-41d4-a716-446655440000",base=`/conversations/${id}/messages/${id}/attachments/${id}/preview`;
beforeEach(()=>{jest.clearAllMocks();authorize.mockResolvedValue({});preview.mockResolvedValue({filePath:file,mimeType:"image/webp"});});
afterAll(()=>rmSync(directory,{recursive:true,force:true}));
test.each(["images/320","images/640","thumbnail","video.mp4","stream/master.m3u8","stream/360p/index.m3u8","stream/360p/segment_000000.ts"])("%s enforces conversation/message/asset access before serving",async path=>{
  const r=await request(app).get(base+"/"+path).set("Authorization","Bearer test");
  expect(r.status).toBe(200);expect(authorize).toHaveBeenCalledWith("viewer",id,id,id);
  expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(preview.mock.invocationCallOrder[0]);
  expect(r.headers["cache-control"]).toBe("private, no-store");
});
test.each([403,404])("inaccessible/left/hidden/deleted resource denial %s prevents preview lookup",async statusCode=>{
  authorize.mockRejectedValue(Object.assign(Error("Denied"),{statusCode}));
  const r=await request(app).get(base+"/images/320").set("Authorization","Bearer test");
  expect(r.status).toBe(statusCode);expect(preview).not.toHaveBeenCalled();
});
test("authentication required",async()=>{
  expect((await request(app).get(base+"/stream/master.m3u8")).status).toBe(401);
  expect(authorize).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();
});
test.each(["images/999","stream/999p/index.m3u8","stream/360p/private.mp4"])("invalid resource %s is rejected before delivery",async path=>{
  expect((await request(app).get(base+"/"+path).set("Authorization","Bearer test")).status).toBe(400);
  expect(authorize).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();
});
test("optimized MP4 preserves byte-range delivery",async()=>{
  preview.mockResolvedValue({filePath:file,mimeType:"video/mp4"});
  const r=await request(app).get(base+"/video.mp4").set("Authorization","Bearer test").set("Range","bytes=0-3");
  expect(r.status).toBe(206);expect(r.headers["content-range"]).toBe("bytes 0-3/10");
});
