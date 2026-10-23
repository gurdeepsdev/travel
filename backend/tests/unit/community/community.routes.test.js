import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
const create=jest.fn(),get=jest.fn();
const methods={create,get,list:jest.fn(),update:jest.fn(),remove:jest.fn(),join:jest.fn(),
  memberAction:jest.fn(),members:jest.fn(),requests:jest.fn(),review:jest.fn()};
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js',()=>({default:{authenticate:(req,res,next)=>{
  if(!req.headers.authorization)return res.status(401).json({success:false});
  req.user={id:'11111111-1111-4111-8111-111111111111'};next();
}}}));
jest.unstable_mockModule('../../../src/modules/community/community.service.js',()=>({default:methods}));
jest.unstable_mockModule('../../../src/modules/community/community-image-upload.js',()=>({uploadCommunityImage:(_req,res)=>res.json({success:true})}));
const {default:router}=await import('../../../src/modules/community/community.routes.js');
const {default:errors}=await import('../../../src/middleware/error.middleware.js');
const app=express();app.use(express.json());app.use('/api/v1',router);app.use(errors);
beforeEach(()=>{jest.clearAllMocks();for(const fn of Object.values(methods))fn.mockResolvedValue({});});
test('community routes require authentication',async()=>{
  expect((await request(app).get('/api/v1/communities')).status).toBe(401);
});
test('create passes validated fields and returns 201',async()=>{
  create.mockResolvedValue({community:{id:'created'}});
  const response=await request(app).post('/api/v1/communities').set('Authorization','Bearer test').send({name:'Delhi',iconAssetId:'11111111-1111-4111-8111-111111111111'});
  expect(response.status).toBe(201);
  expect(create).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({name:'Delhi',joinType:'OPEN'}));
});
test('invalid IDs never reach the repository',async()=>{
  expect((await request(app).get('/api/v1/communities/not-a-uuid').set('Authorization','Bearer test')).status).toBe(400);
  expect(get).not.toHaveBeenCalled();
});
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
const routes=[
  ['post','/communities/images',undefined,null],
  ['post','/communities',{name:'Delhi',iconAssetId:id},'create'],
  ['get','/communities',undefined,'list'],
  ['get','/users/me/communities',undefined,'list'],
  ['get',`/communities/${id}`,undefined,'get'],
  ['patch',`/communities/${id}`,{name:'Updated'},'update'],
  ['delete',`/communities/${id}`,undefined,'remove'],
  ['post',`/communities/${id}/join`,undefined,'join'],
  ['post',`/communities/${id}/leave`,undefined,'memberAction'],
  ['get',`/communities/${id}/members`,undefined,'members'],
  ['patch',`/communities/${id}/members/${user}/role`,{role:'ADMIN'},'memberAction'],
  ['delete',`/communities/${id}/members/${user}`,undefined,'memberAction'],
  ['get',`/communities/${id}/bans`,undefined,'members'],
  ['put',`/communities/${id}/bans/${user}`,{reason:'spam'},'memberAction'],
  ['delete',`/communities/${id}/bans/${user}`,undefined,'memberAction'],
  ['get',`/communities/${id}/join-requests`,undefined,'requests'],
  ['patch',`/communities/${id}/join-requests/${user}`,{status:'ACCEPTED'},'review'],
  ['delete',`/communities/${id}/join-requests/${user}`,undefined,'review'],
];
test.each(routes)('%s %s dispatches the documented operation',async(method,path,body,action)=>{
  let call=request(app)[method]('/api/v1'+path).set('Authorization','Bearer test');
  if(body)call=call.send(body);const response=await call;
  expect(response.status).toBe(action==='create'?201:200);
  if(action)expect(methods[action]).toHaveBeenCalledTimes(1);
});
test.each(routes)('%s %s rejects missing authentication',async(method,path,body)=>{
  let call=request(app)[method]('/api/v1'+path);if(body)call=call.send(body);
  expect((await call).status).toBe(401);
  for(const fn of Object.values(methods))expect(fn).not.toHaveBeenCalled();
});
