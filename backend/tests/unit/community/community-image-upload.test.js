import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
const store=jest.fn(),remove=jest.fn(),resolve=jest.fn();
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{transaction:fn=>fn({})}}));
jest.unstable_mockModule('../../../src/providers/storage/storage-manager.js',()=>({default:{store,remove}}));
jest.unstable_mockModule('../../../src/modules/media/media.repository.js',()=>({default:{resolveUploadedAssets:resolve}}));
const {uploadCommunityImage}=await import('../../../src/modules/community/community-image-upload.js');
const app=express();app.post('/upload',(req,res,next)=>{req.user={id:'user'};next();},uploadCommunityImage);
app.use((error,req,res,next)=>res.status(error.statusCode??500).json({code:error.code}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=','base64');
beforeEach(()=>{jest.resetAllMocks();store.mockResolvedValue({storageKey:'community/test.png',storageProvider:'local',bucket:'local'});resolve.mockResolvedValue({assets:[{id:'asset',mime_type:'image/png'}],unusedStoredObjects:[],supersededStoredObjects:[]});});
test('community image signature is checked before storage',async()=>{
  const result=await request(app).post('/upload').attach('image',Buffer.from('not an image'),{filename:'fake.png',contentType:'image/png'});
  expect(result.status).toBe(415);expect(store).not.toHaveBeenCalled();
});
test('public owned image is persisted and returns only delivery metadata',async()=>{
  const result=await request(app).post('/upload').attach('image',png,{filename:'photo.png',contentType:'image/png'});
  expect(result.status).toBe(200);expect(result.body.data.asset).toMatchObject({id:'asset',mimeType:'image/png'});
  expect(resolve).toHaveBeenCalledWith(expect.objectContaining({userId:'user',isPublic:true}));
  expect(JSON.stringify(result.body)).not.toContain('storageKey');
});
test('failed persistence cleans the stored object',async()=>{
  resolve.mockRejectedValue(new Error('database failure'));
  expect((await request(app).post('/upload').attach('image',png,{filename:'photo.png',contentType:'image/png'})).status).toBe(500);
  expect(remove).toHaveBeenCalledWith(expect.objectContaining({storageKey:'community/test.png'}));
});
