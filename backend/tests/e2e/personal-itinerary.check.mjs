import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import db from '../../src/database/database-manager.js';
import env from '../../src/config/env.js';
import jwt from '../../src/core/security/jwt.js';
import redis from '../../src/config/redis.js';
import app from '../../src/app.js';

assert(['development','test'].includes(env.NODE_ENV));
assert(['localhost','127.0.0.1','::1'].includes(env.DB_HOST));
const client=await db.getClient(),query=db.query,transaction=db.transaction;
const users=Array.from({length:4},()=>randomUUID()),tokens=[];
let checks=0,seq=0;
await client.query('BEGIN');
db.query=(...args)=>client.query(...args);
db.transaction=async fn=>{
  const point=`personal_${++seq}`;
  await client.query(`SAVEPOINT ${point}`);
  try { const result=await fn(client);await client.query(`RELEASE SAVEPOINT ${point}`);return result; }
  catch(e){await client.query(`ROLLBACK TO SAVEPOINT ${point}`);throw e;}
};
const call=async(method,path,actor,body,status=200)=>{
  const req=request(app)[method](`/api/v1${path}`).set('Authorization',`Bearer ${tokens[actor]}`);
  const res=await (body===undefined?req:req.send(body));
  assert.equal(res.status,status,`${method} ${path}: ${JSON.stringify(res.body)}`);checks++;
  return res.body.data;
};
try {
  for(const id of users){
    const sid=randomUUID();
    await client.query("INSERT INTO auth.users(id,status) VALUES ($1,'ACTIVE')",[id]);
    await client.query('INSERT INTO users.profiles(user_id,username) VALUES ($1,$2)',[id,`personal_${id.replaceAll('-','')}`]);
    await client.query("INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'fixture',$3)",[sid,id,new Date(Date.now()+86400000)]);
    tokens.push(jwt.generateAccessToken({sub:id,sid,ver:1}));
  }
  const group=(await call('post','/groups',0,{name:'Four personal states'})).group;
  for(let a=1;a<4;a++){
    await client.query('INSERT INTO users.connections(user_low_id,user_high_id) VALUES (LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))',[users[0],users[a]]);
    const invite=(await call('post',`/groups/${group.id}/invitations`,0,{userId:users[a]})).invitation;
    await call('patch',`/users/me/group-invitations/${invite.id}`,a,{status:'ACCEPTED'});
  }
  const payload={request_id:randomUUID(),status:'success',mode:'future',city_id:'delhi',
    summary:{num_days:1,total_places:1},days:[{day:1,items:[{item_type:'poi',place_id:'test-place'}]}]};
  const itinerary=(await call('post','/itineraries',0,payload,201)).itinerary;
  const base=`/itineraries/${itinerary.id}`;
  await call('put',`/groups/${group.id}/itinerary`,0,{itineraryId:itinerary.id});
  for(let a=0;a<4;a++){
    assert((await call('get','/itineraries?status=PLANNED',a)).itineraries.some(i=>i.id===itinerary.id));
    assert.equal((await call('get',`${base}/expense-participants`,a)).totalCount,4);
    const detail=await call('get',base,a);
    assert.equal(detail.itinerary.tripStatus.toUpperCase(),'PLANNED');
  }
  await call('delete',`/groups/${group.id}/itinerary`,0);
  for(let a=1;a<4;a++) {
    assert(!(await call('get','/itineraries',a)).itineraries.some(i=>i.id===itinerary.id));
    await call('patch',`${base}/status`,a,{status:'UPCOMING'},404);
  }
  await call('put',`/groups/${group.id}/itinerary`,0,{itineraryId:itinerary.id});
  await call('post',`${base}/expenses`,2,{paidBy:users[2],category:'FOOD',title:'Planned group meal',amount:100,
    currencyCode:'INR',paymentMethod:'CASH',expenseDate:'2026-09-14',splitType:'EQUAL',
    participants:users.map(userId=>({userId}))},201);
  const balances=await call('get',`${base}/expense-balances`,0);
  for(let a=1;a<4;a++) assert.deepEqual(await call('get',`${base}/expense-balances`,a),balances);
  for(let a=1;a<4;a++){
    await call('patch',`${base}/status`,a,{status:'UPCOMING'});
    if(a>=2) await call('patch',`${base}/status`,a,{status:'LIVE'});
    if(a===3) await call('patch',`${base}/status`,a,{status:'COMPLETED'});
  }
  for(const [a,status] of ['PLANNED','UPCOMING','LIVE','COMPLETED'].entries()){
    const list=await call('get',`/itineraries?status=${status}`,a);
    assert(list.itineraries.some(i=>i.id===itinerary.id));
    assert.equal((await call('get',base,a)).itinerary.tripStatus.toUpperCase(),status);
    assert.equal((await call('get',`${base}/dashboard`,a)).itinerary.tripStatus.toUpperCase(),status);
    assert.deepEqual(await call('get',`${base}/expense-balances`,a),balances);
  }
  await call('patch',`${base}/status`,1,{status:'PLANNED'});
  assert.equal((await call('patch',`${base}/status`,1,{status:'PLANNED'})).updated,false);
  await call('patch',`${base}/status`,1,{status:'COMPLETED'},409);
  await call('post',`/groups/${group.id}/leave`,1,{});
  assert(!(await call('get','/itineraries',1)).itineraries.some(i=>i.id===itinerary.id));
  await call('get',base,1,undefined,404);
  await call('patch',`${base}/status`,1,{status:'UPCOMING'},404);
  await call('get',`${base}/expenses/dashboard`,1,undefined,404);
  await call('delete',`/groups/${group.id}/members/${users[2]}`,0);
  assert(!(await call('get','/itineraries?status=LIVE',2)).itineraries.some(i=>i.id===itinerary.id));
  await call('patch',`${base}/status`,2,{status:'COMPLETED'},404);
  await call('get',`${base}/expenses/dashboard`,2,undefined,404);
  const reinvite=(await call('post',`/groups/${group.id}/invitations`,0,{userId:users[2]})).invitation;
  await call('patch',`/users/me/group-invitations/${reinvite.id}`,2,{status:'ACCEPTED'});
  assert.equal((await call('get',base,2)).itinerary.tripStatus.toUpperCase(),'LIVE');
  assert.deepEqual(await call('get',`${base}/expense-balances`,0),balances);
  const {rows:[count]}=await client.query('SELECT COUNT(*)::int AS n FROM trip.trips WHERE itinerary_id=$1',[itinerary.id]);
  assert.equal(count.n,1);
  console.log(`PASS: ${checks} personal itinerary HTTP checks; four independent states, one shared trip/ledger.`);
} finally {
  await client.query('ROLLBACK');db.query=query;db.transaction=transaction;
  client.release();await db.pool.end();redis.disconnect();console.log('Rolled back personal fixtures.');
}
