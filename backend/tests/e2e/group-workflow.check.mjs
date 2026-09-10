// Run explicitly from backend: node tests/e2e/group-workflow.check.mjs
// Real HTTP/auth/SQL checks; all fixture rows are rolled back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import db from '../../src/database/database-manager.js';
import env from '../../src/config/env.js';
import jwt from '../../src/core/security/jwt.js';
import storage from '../../src/providers/storage/storage-manager.js';
import redis from '../../src/config/redis.js';
import app from '../../src/app.js';

assert(['development','test'].includes(env.NODE_ENV), 'Local development/test environment required');
assert(['localhost','127.0.0.1','::1'].includes(env.DB_HOST), 'Loopback database required');
const client=await db.getClient(), originalQuery=db.query, originalTransaction=db.transaction;
const users=[randomUUID(),randomUUID(),randomUUID()], tokens=[];
let savepoint=0, checks=0;
await client.query('BEGIN');
db.query=(...args)=>client.query(...args);
db.transaction=async callback=>{
  const name=`group_test_${++savepoint}`;
  await client.query(`SAVEPOINT ${name}`);
  try {const result=await callback(client);await client.query(`RELEASE SAVEPOINT ${name}`);return result;}
  catch(error){await client.query(`ROLLBACK TO SAVEPOINT ${name}`);throw error;}
};
const call=async(method,path,actor,body,status=200)=>{
  let req=request(app)[method](`/api/v1${path}`);
  if(actor!==null) req=req.set('Authorization',`Bearer ${tokens[actor]}`);
  if(body!==undefined) req=req.send(body);
  const response=await req;
  assert.equal(response.status,status,`${method} ${path}: ${response.body.code ?? response.status}`);
  checks++;
  return response.body.data;
};
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
try {
  for(const id of users){
    const sid=randomUUID();
    await client.query("INSERT INTO auth.users(id,status) VALUES ($1,'ACTIVE')",[id]);
    await client.query('INSERT INTO users.profiles(user_id,username) VALUES ($1,$2)',[id,`e2e_${id.replaceAll('-','')}`]);
    await client.query("INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'fixture',$3)",[sid,id,new Date(Date.now()+86400000)]);
    tokens.push(jwt.generateAccessToken({sub:id,sid,ver:1}));
  }
  await client.query('INSERT INTO users.connections(user_low_id,user_high_id) VALUES (LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))',[users[0],users[1]]);
  const payload={request_id:randomUUID(),status:'success',mode:'future',city_id:'delhi',
    summary:{num_days:1,total_places:1},days:[{day:1,items:[{item_type:'poi',place_id:'test-google-place'}]}]};
  await call('post','/groups',null,{name:'Unauthenticated'},401);
  await call('post','/groups',0,{name:' '},400);
  const standalone=(await call('post','/groups',0,{name:'Group first'})).group;
  assert.equal(standalone.itineraryId,null);
  const first=(await call('post','/itineraries',0,payload,201)).itinerary;
  const linkPath=`/groups/${standalone.id}/itinerary`;
  await call('put',linkPath,1,{itineraryId:first.id},404);
  await call('put',linkPath,0,{itineraryId:'invalid'},400);
  await call('patch',`/itineraries/${first.id}/status`,0,{status:'UPCOMING'});
  assert.equal((await call('put',linkPath,0,{itineraryId:first.id})).updated,true);
  assert.equal((await call('put',linkPath,0,{itineraryId:first.id})).updated,false);
  assert.equal((await call('put',linkPath,0,{itineraryId:first.id.toUpperCase()})).updated,false);
  const another=(await call('post','/groups',0,{name:'Another group'})).group;
  await call('put',`/groups/${another.id}/itinerary`,0,{itineraryId:first.id},409);
  const otherItinerary=(await call('post','/itineraries',0,payload,201)).itinerary;
  await call('put',linkPath,0,{itineraryId:otherItinerary.id},409);
  const groupFirstInvite=(await call('post',`/itineraries/${first.id}/group/invitations`,0,{userId:users[1]})).invitation;
  await call('get',`/itineraries/${first.id}`,1,undefined,404);
  await call('patch',`/users/me/group-invitations/${groupFirstInvite.id}`,1,{status:'ACCEPTED'});
  assert.equal((await call('get',`/itineraries/${first.id}/group/members`,1)).totalCount,2);
  assert.equal((await call('get',`/itineraries/${first.id}/expense-participants`,1)).totalCount,2);
  await call('get',`/itineraries/${first.id}`,1);
  const solo=await call('post','/itineraries',0,payload,201);
  assert(!solo.group);
  await call('patch',`/itineraries/${solo.itinerary.id}/status`,0,{status:'UPCOMING'});
  await call('post',`/itineraries/${solo.itinerary.id}/expense-participants`,0,{userId:users[1]},201);
  const saved=await call('post','/itineraries',0,{...payload,planTogether:true},201);
  const id=saved.itinerary.id, base=`/itineraries/${id}`;
  assert.equal(saved.group.ownerId,users[0]);
  assert(!('planTogether' in saved.itinerary.itineraryJson));
  await call('get',`${base}/group/members`,null,undefined,401);
  assert.equal((await call('get',`${base}/group/members`,0)).totalCount,1);
  await call('get',base,2,undefined,404);
  await call('patch',`${base}/status`,0,{status:'UPCOMING'});
  const invitation=(await call('post',`${base}/group/invitations`,0,{userId:users[1]})).invitation;
  await call('get',base,1,undefined,404);
  await call('get',`${base}/expenses/dashboard`,1,undefined,404);
  await call('post',`${base}/expense-participants`,0,{userId:users[1]},422);
  const inbox=await call('get','/users/me/group-invitations?status=PENDING',1);
  assert.equal(inbox.invitations[0].id,invitation.id);
  await call('patch',`/users/me/group-invitations/${invitation.id}`,2,{status:'ACCEPTED'},404);
  await call('patch',`/users/me/group-invitations/${invitation.id}`,1,{status:'ACCEPTED'});
  assert.equal((await call('get',`${base}/group/members`,1)).totalCount,2);
  await call('get',base,1);
  await call('get',`${base}/dashboard`,1);
  await call('patch',`${base}/name`,1,{name:'Forbidden edit'},404);
  await call('post',`${base}/expenses`,1,{paidBy:users[1],category:'FOOD',title:'E2E meal',amount:100,
    currencyCode:'INR',paymentMethod:'CASH',expenseDate:'2026-09-10',splitType:'EQUAL',
    participants:[{userId:users[0]},{userId:users[1]}]},201);
  await call('get',`${base}/expenses/dashboard`,0);
  const before=await call('get',`${base}/expense-balances`,0);
  const upload=await request(app).post(`/api/v1${base}/vault/documents`)
    .set('Authorization',`Bearer ${tokens[1]}`).field('documentType','OTHER').field('title','Member PDF')
    .attach('documentFile',pdf,{filename:'group-e2e.pdf',contentType:'application/pdf'});
  assert.equal(upload.status,201,upload.body.code); checks++;
  const doc=upload.body.data.document, docPath=`${base}/vault/documents/${doc.id}`;
  assert.equal(doc.visibility,'PRIVATE');
  assert.equal((await call('get',`${base}/vault/documents`,0)).documents.length,0);
  await call('get',`${docPath}/download`,0,undefined,404);
  await call('patch',`${docPath}/visibility`,0,{visibility:'GROUP'},404);
  await call('patch',`${docPath}/visibility`,1,{visibility:'GROUP'});
  const download=await request(app).get(`/api/v1${docPath}/download`).set('Authorization',`Bearer ${tokens[0]}`);
  assert.equal(download.status,200);assert.deepEqual(download.body,pdf);
  assert.equal(download.headers['cache-control'],'private, no-store');checks++;
  await call('get',`${docPath}/download`,2,undefined,404);
  await call('post',`${base}/group/leave`,0,{},409);
  await call('delete',`${base}/group/members/${users[1]}`,0);
  await call('get',base,1,undefined,404);
  await call('get',`${base}/dashboard`,1,undefined,404);
  await call('get',`${base}/expenses/dashboard`,1,undefined,404);
  assert.deepEqual(await call('get',`${base}/expense-balances`,0),before);
  await call('post',`${base}/expense-participants`,0,{userId:users[1]},422);
  await call('get',`${docPath}/download`,1);
  await call('patch',`${docPath}/visibility`,1,{visibility:'PRIVATE'});
  await call('get',`${docPath}/download`,0,undefined,404);
  await call('delete',docPath,1);
  await call('get',`${docPath}/download`,1,undefined,404);
  console.log(`PASS: ${checks} HTTP checks with real JWT authentication, local PostgreSQL, multipart upload, and binary download.`);
} finally {
  try {
    const {rows}=await client.query('SELECT storage_key FROM media.assets WHERE uploaded_by=ANY($1::uuid[])',[users]);
    for(const row of rows) await storage.remove({storageKey:row.storage_key});
  } finally {
    await client.query('ROLLBACK');db.query=originalQuery;db.transaction=originalTransaction;
    client.release();await db.pool.end();redis.disconnect();
    console.log('Rolled back fixture rows and removed test uploads.');
  }
}
