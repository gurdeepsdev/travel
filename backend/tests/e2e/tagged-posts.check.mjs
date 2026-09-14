// Local HTTP/auth/SQL verification; fixture writes are always rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import db from '../../src/database/database-manager.js';
import env from '../../src/config/env.js';
import jwt from '../../src/core/security/jwt.js';
import redis from '../../src/config/redis.js';
import app from '../../src/app.js';

assert(['development','test'].includes(env.NODE_ENV));
assert(['localhost','127.0.0.1','::1'].includes(env.DB_HOST));
const client=await db.getClient(), originalQuery=db.query;
const users=Array.from({length:4},()=>randomUUID()), tokens=[], names=users.map(id=>`tag_${id.replaceAll('-','')}`);
let checks=0;
const get=async(path,actor=null,status=200)=>{
  let req=request(app).get(`/api/v1/users/${path}`);
  if(actor!==null) req=req.set('Authorization',`Bearer ${tokens[actor]}`);
  const response=await req;
  assert.equal(response.status,status,`${path}: ${JSON.stringify(response.body)}`);
  checks++;
  return response.body.data;
};
const ids=data=>data.posts.map(p=>p.id).sort();
const connect=async(a,b)=>client.query('INSERT INTO users.connections(user_low_id,user_high_id) VALUES (LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))',[users[a],users[b]]);
await client.query('BEGIN');
db.query=(...args)=>client.query(...args);
try {
  for(let i=0;i<users.length;i++){
    const sid=randomUUID();
    await client.query("INSERT INTO auth.users(id,status) VALUES ($1,'ACTIVE')",[users[i]]);
    await client.query('INSERT INTO users.profiles(user_id,username,is_private) VALUES ($1,$2,$3)',[users[i],names[i],i===0]);
    await client.query("INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'fixture',$3)",[sid,users[i],new Date(Date.now()+86400000)]);
    tokens.push(jwt.generateAccessToken({sub:users[i],sid,ver:1}));
  }
  const country=randomUUID(),region=randomUUID(),city=randomUUID();
  await client.query('INSERT INTO poi.countries(id,name,code) VALUES ($1,$2,$2)',[country,`test_${country}`]);
  await client.query("INSERT INTO poi.regions(id,country_id,name) VALUES ($1,$2,'Tagged test region')",[region,country]);
  await client.query("INSERT INTO poi.cities(id,region_id,country_id,name) VALUES ($1,$2,$3,'Tagged test city')",[city,region,country]);
  const seedPost=async(owner,visibility,tagged=true,deleted=false)=>{
    const id=randomUUID();
    await client.query(`INSERT INTO explore.posts(id,user_id,post_type,visibility,city_id,created_at,deleted_at)
      VALUES ($1,$2,'CITY',$3,$4,'2026-01-01 00:00:00.123456',CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE NULL END)`,[id,users[owner],visibility,city,deleted]);
    if(tagged) await client.query('INSERT INTO explore.post_tagged_users(post_id,tagged_user_id,tagged_by) VALUES ($1,$2,$3)',[id,users[0],users[owner]]);
    return id;
  };
  const pub=await seedPost(2,'PUBLIC'), priv=await seedPost(2,'PRIVATE'), own=await seedPost(0,'PRIVATE');
  await seedPost(2,'PUBLIC',true,true);
  await seedPost(2,'PUBLIC',false);
  const video=randomUUID();
  await client.query(`INSERT INTO media.assets(id,storage_provider,bucket,storage_key,original_filename,mime_type,extension,file_size,checksum,uploaded_by)
    VALUES ($1,'local','local',$2,'tag-test.mp4','video/mp4','mp4',100,$1::uuid::text,$3)`,[video,`test/${video}.mp4`,users[2]]);
  await client.query('INSERT INTO explore.post_assets(post_id,asset_id,display_order) VALUES ($1,$2,0)',[pub,video]);
  await client.query(`INSERT INTO media.asset_variants(asset_id,variant_name,format,quality,width,height,storage_key,file_size)
    VALUES ($1,'thumbnail','jpg',85,100,100,$2,20)`,[video,`test/${video}.jpg`]);
  await connect(0,1);
  await get('me/tagged-posts',null,401);
  await get('me/tagged-posts?limit=51',0,400);
  await get('me/tagged-posts?cursor=bad',0,400);
  await get(`${names[0]}/tagged-posts?limit=0`,1,400);
  await get(`${names[0]}/tagged-posts?extra=1`,1,400);
  await get('missing_tag_profile/tagged-posts',null,404);
  assert.deepEqual(ids(await get('me/tagged-posts',0)),[pub,own].sort());
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`,0)),[pub,own].sort());
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`)),[]);
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`,3)),[]);
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`,1)),[pub,own].sort());
  assert.deepEqual(ids(await get('me/tagged-posts',1)),[]);
  await connect(0,2);
  assert.deepEqual(ids(await get('me/tagged-posts',0)),[pub,priv,own].sort());
  await connect(1,2);
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`,1)),[pub,priv,own].sort());
  await client.query('INSERT INTO explore.post_likes(post_id,user_id) VALUES ($1,$2)',[pub,users[1]]);
  const rich=(await get(`${names[0]}/tagged-posts`,1)).posts.find(p=>p.id===pub);
  assert.equal(rich.viewerState.liked,true);
  assert.equal(rich.assets[0].mimeType,'video/mp4');
  assert(rich.assets[0].thumbnailUrl.endsWith(`/api/v1/media/assets/${video}/thumbnail`));
  assert.equal(rich.assets[0].processingStatus,'READY');
  const seen=[];let cursor=null;
  do {
    const page=await get(`me/tagged-posts?limit=1${cursor?`&cursor=${cursor}`:''}`,0);
    seen.push(...page.posts.map(p=>p.id));cursor=page.pagination.nextCursor;
    assert(seen.length<=3,'Pagination repeated rows');
  } while(cursor);
  assert.deepEqual([...seen].sort(),[pub,priv,own].sort());
  assert.equal(new Set(seen).size,3);
  await client.query('UPDATE users.profiles SET is_private=false WHERE user_id=$1',[users[0]]);
  const anonymous=await get(`${names[0]}/tagged-posts`);
  assert.deepEqual(ids(anonymous),[pub]);
  assert.equal(anonymous.posts[0].viewerState.liked,false);
  const regular=await get(`${names[2]}/posts`,1);
  assert.deepEqual(regular.posts.find(p=>p.id===pub),rich);
  for(const [a,b] of [[0,1],[1,0]]){
    await client.query('INSERT INTO users.blocked_users(user_id,blocked_user_id) VALUES ($1,$2)',[users[a],users[b]]);
    assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`,1)),[]);
    await client.query('DELETE FROM users.blocked_users WHERE user_id=$1 AND blocked_user_id=$2',[users[a],users[b]]);
  }
  for(const [a,b] of [[2,1],[1,2]]){
    await client.query('INSERT INTO users.blocked_users(user_id,blocked_user_id) VALUES ($1,$2)',[users[a],users[b]]);
    assert(!ids(await get(`${names[0]}/tagged-posts`,1)).includes(pub));
    await client.query('DELETE FROM users.blocked_users WHERE user_id=$1 AND blocked_user_id=$2',[users[a],users[b]]);
  }
  await client.query('DELETE FROM explore.post_tagged_users WHERE post_id=$1',[pub]);
  assert.deepEqual(ids(await get(`${names[0]}/tagged-posts`)),[]);
  await client.query('UPDATE users.profiles SET deleted_at=CURRENT_TIMESTAMP WHERE user_id=$1',[users[0]]);
  await get(`${names[0]}/tagged-posts`,1,404);
  console.log(`PASS: ${checks} tagged-post HTTP checks with real JWT and PostgreSQL.`);
} finally {
  await client.query('ROLLBACK');db.query=originalQuery;client.release();
  await db.pool.end();redis.disconnect();
  console.log('Rolled back tagged-post fixtures.');
}
