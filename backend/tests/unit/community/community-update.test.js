import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { access } from 'node:fs/promises';

const id='11111111-1111-4111-8111-111111111111',assetId='22222222-2222-4222-8222-222222222222';
const store=jest.fn(),remove=jest.fn(),resolve=jest.fn(),update=jest.fn(),get=jest.fn(),lockForUpdate=jest.fn(),updateInTransaction=jest.fn();
const client={},transaction=jest.fn(fn=>fn(client));
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{transaction}}));
jest.unstable_mockModule('../../../src/providers/storage/storage-manager.js',()=>({default:{store,remove}}));
jest.unstable_mockModule('../../../src/modules/media/media.repository.js',()=>({default:{resolveUploadedAssets:resolve}}));
jest.unstable_mockModule('../../../src/modules/community/community.service.js',()=>({default:{update,get,lockForUpdate,updateInTransaction}}));
const {updateCommunity}=await import('../../../src/modules/community/community-update.js');
const app=express();app.use(express.json());
app.patch('/communities/:communityId',(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:'user'};next();},updateCommunity);
app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII=','base64');
const patch=()=>request(app).patch(`/communities/${id}`).set('Authorization','Bearer test');
const image=call=>call.attach('image',png,{filename:'photo.png',contentType:'image/png'});
beforeEach(()=>{
  jest.resetAllMocks();transaction.mockImplementation(fn=>fn(client));
  store.mockResolvedValue({storageKey:'community/new.png',storageProvider:'local',bucket:'local'});
  resolve.mockResolvedValue({assets:[{id:assetId}],unusedStoredObjects:[],supersededStoredObjects:[]});
  get.mockResolvedValue({community:{id,viewerRole:'ADMIN',image:{id:assetId}}});
  update.mockResolvedValue({community:{id}});
});
test('multipart accepts all create fields and replaces the image transactionally',async()=>{
  const response=await image(patch().field('name',' Updated ').field('description','New description').field('joinType','APPROVAL'));
  expect(response.status).toBe(200);expect(response.body.data.community.id).toBe(id);
  expect(lockForUpdate).toHaveBeenCalledWith('user',id,client);
  expect(resolve).toHaveBeenCalledWith(expect.objectContaining({client,userId:'user',isPublic:true}));
  expect(updateInTransaction).toHaveBeenCalledWith('user',id,{name:'Updated',description:'New description',joinType:'APPROVAL',iconAssetId:assetId},client);
  expect(lockForUpdate.mock.invocationCallOrder[0]).toBeLessThan(resolve.mock.invocationCallOrder[0]);
  await expect(access(store.mock.calls[0][0].temporaryPath)).rejects.toMatchObject({code:'ENOENT'});
});
test('image-only update preserves omitted metadata, including joinType',async()=>{
  expect((await image(patch())).status).toBe(200);
  expect(updateInTransaction).toHaveBeenCalledWith('user',id,{iconAssetId:assetId},client);
});
test.each([['name','Updated'],['description','Description'],['joinType','OPEN']])('multipart %s without image is a normal partial update',async(field,value)=>{
  expect((await patch().field(field,value)).status).toBe(200);
  expect(update).toHaveBeenCalledWith('user',id,{[field]:value});
  expect(store).not.toHaveBeenCalled();expect(transaction).not.toHaveBeenCalled();
});
test('JSON icon and metadata updates remain supported',async()=>{
  expect((await patch().send({iconAssetId:assetId,description:null})).status).toBe(200);
  expect(update).toHaveBeenCalledWith('user',id,{iconAssetId:assetId,description:null});expect(store).not.toHaveBeenCalled();
});
test.each([{name:''},{name:'x'.repeat(101)},{description:'x'.repeat(251)},{joinType:'PUBLIC'},{iconAssetId:assetId},{extra:'field'}])('invalid multipart fields %j are rejected before storage',async fields=>{
  let call=patch();for(const [key,value]of Object.entries(fields))call=call.field(key,value);
  expect((await image(call)).status).toBe(400);expect(store).not.toHaveBeenCalled();
});
test('empty JSON and text-only multipart patches are rejected',async()=>{
  expect((await patch().send({})).status).toBe(400);
  expect((await patch().set('Content-Type','multipart/form-data; boundary=empty').send('--empty--\r\n')).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
test('authentication required',async()=>{
  expect((await image(request(app).patch(`/communities/${id}`))).status).toBe(401);expect(store).not.toHaveBeenCalled();
});
test('non-admin image update is rejected before inspecting/storing media',async()=>{
  get.mockResolvedValue({community:{id,viewerRole:'MEMBER'}});
  expect((await image(patch())).status).toBe(404);expect(store).not.toHaveBeenCalled();
});
test('revoked admin access is rechecked before media persistence and stored upload is removed',async()=>{
  lockForUpdate.mockRejectedValue({statusCode:404});
  expect((await image(patch())).status).toBe(404);expect(resolve).not.toHaveBeenCalled();expect(remove).toHaveBeenCalled();
});
test('transaction failure removes new upload but never the previous image',async()=>{
  updateInTransaction.mockRejectedValue(new Error('event failure'));
  expect((await image(patch())).status).toBe(500);
  expect(remove).toHaveBeenCalledTimes(1);expect(remove).toHaveBeenCalledWith(expect.objectContaining({storageKey:'community/new.png'}));
});
test('a response read failure never deletes committed media',async()=>{
  get.mockResolvedValueOnce({community:{id,viewerRole:'ADMIN'}}).mockRejectedValueOnce(new Error('read failure'));
  expect((await image(patch())).status).toBe(500);expect(remove).not.toHaveBeenCalled();
});
test('disguised non-image file is rejected',async()=>{
  expect((await patch().attach('image',Buffer.from('fake'),{filename:'fake.png',contentType:'image/png'})).status).toBe(415);expect(store).not.toHaveBeenCalled();
});
test('oversized image is rejected',async()=>{
  expect((await patch().attach('image',Buffer.alloc(10*1024*1024+1),'large.png')).status).toBe(413);expect(store).not.toHaveBeenCalled();
});
test('multiple images are rejected',async()=>{
  expect((await image(image(patch()))).status).toBe(400);expect(store).not.toHaveBeenCalled();
});
test('malformed multipart returns 400',async()=>{
  expect((await patch().set('Content-Type','multipart/form-data').send('broken')).status).toBe(400);expect(store).not.toHaveBeenCalled();
});
