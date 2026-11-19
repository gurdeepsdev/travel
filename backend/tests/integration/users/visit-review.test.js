import {jest} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';
let directory,pool,admin,user,city,icon,evidence,submission,place;
let failAudit=false;
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const c=await pool.connect();try{await c.query('BEGIN');const result=await fn({query:(sql,args)=>{if(failAudit&&sql.includes('INSERT INTO users.visit_verification_reviews'))throw Error('audit failed');return c.query(sql,args);}});await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js',()=>({default:{authenticate:(req,res,next)=>{
  const id=req.get('Authorization')?.replace('Bearer ','');if(!id)return res.sendStatus(401);req.user={id};next();
}}}));
const media=jest.fn().mockResolvedValue({asset:{mime_type:'image/jpeg'},filePath:new URL(import.meta.url).pathname});
jest.unstable_mockModule('../../../src/modules/media/media.service.js',()=>({default:{getLocalAssetContent:media}}));
const {default:routes}=await import('../../../src/modules/users/visit-review/visit-review.routes.js');
const {default:repo}=await import('../../../src/modules/users/visit-review/visit-review.repository.js');
const {default:userRepo}=await import('../../../src/modules/users/repositories/visited-places.repository.js');
const {default:mapper}=await import('../../../src/modules/users/mappers/visited-places.mapper.js');
const app=express();app.use(express.json());app.use('/admin/visit-verifications',routes);
app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code??'INTERNAL'}));
const api=(method,path='',body,actor=admin)=>{const req=request(app)[method](`/admin/visit-verifications${path}`);if(actor)req.set('Authorization',`Bearer ${actor}`);return body?req.send(body):req;};
const review=(decision='VERIFIED',extra={})=>({decision,evidenceAssetId:evidence,...extra});
async function addPlace(){
  const id=randomUUID();await pool.query(`INSERT INTO users.visited_places(id,user_id,place_id,collections_id,verification_asset_id,verification_status) VALUES($1,$2,$3,$4,$5,'PENDING')`,[id,user,place,submission,evidence]);return id;
}
async function profileCollections(){
  const source=readFileSync(new URL('../../../src/modules/users/repositories/profiles.repository.js',import.meta.url),'utf8');
  const end=source.indexOf(') AS preferred_collection_stats')+') AS preferred_collection_stats'.length;
  const start=source.lastIndexOf('LEFT JOIN LATERAL (',end);
  const sql=`SELECT preferred_collection_stats.collections FROM (SELECT $1::uuid AS user_id) profile ${source.slice(start,end)} ON TRUE`;
  return (await pool.query(sql,[user])).rows[0].collections;
}
(process.env.RUN_VISIT_REVIEW_DB_TESTS==='1'?describe:describe.skip)('visit review on isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-visit-review-');
    execFileSync('initdb',['-D',`${directory}/data`,'--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',`${directory}/data`,'-l',`${directory}/pg.log`,'-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:'postgres'});
    await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA users;CREATE SCHEMA poi;CREATE SCHEMA media;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE users.profiles(user_id uuid,username text,display_name text);
      CREATE TABLE media.assets(id uuid PRIMARY KEY,uploaded_by uuid,mime_type text,is_public boolean,deleted_at timestamptz,storage_provider text DEFAULT 'local',storage_key text,original_filename text,extension text,file_size bigint,bucket text);
      CREATE TABLE poi.countries(id uuid PRIMARY KEY,name text);
      CREATE TABLE poi.cities(id uuid PRIMARY KEY,name text,official_name text,country_id uuid,icon_asset_id uuid,is_active boolean DEFAULT true,latitude float8,longitude float8);
      CREATE TABLE poi.places(id uuid PRIMARY KEY,name text,city_id uuid,country_id uuid,latitude float8,longitude float8,media_id uuid);
      CREATE TABLE users.collection(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,city_id uuid,collections_name text,icon_asset_id uuid,verification_asset_id uuid,verification_status boolean DEFAULT false,is_preference boolean DEFAULT false,visited_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,city_id));
      CREATE TABLE users.visited_places(id uuid PRIMARY KEY,user_id uuid,place_id uuid,collections_id uuid,verification_asset_id uuid,verification_status text,verification_details jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),visited_at timestamptz DEFAULT now(),visit_source text);`);
    await pool.query(readFileSync(new URL('../../../src/database/migrations/095_visit_verification_reviews.sql',import.meta.url),'utf8'));
    const limits=readFileSync(new URL('../../../src/database/migrations/052_upgrade_visited_place_verification.sql',import.meta.url),'utf8');
    await pool.query(limits.slice(limits.indexOf('CREATE OR REPLACE FUNCTION\n  users.enforce_collection_preference_limit()'),limits.indexOf('COMMENT ON COLUMN')));
  },30000);
  afterAll(async()=>{delete process.env.VISIT_REVIEW_ADMIN_USER_IDS;await pool?.end();if(directory){try{execFileSync('pg_ctl',['-D',`${directory}/data`,'-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{
    failAudit=false;media.mockClear();await pool.query('TRUNCATE users.visit_verification_reviews,users.visited_places,users.collection,users.profiles,poi.places,poi.cities,poi.countries,media.assets,auth.users CASCADE');
    [admin,user,city,icon,evidence,submission,place]=Array.from({length:7},randomUUID);
    process.env.VISIT_REVIEW_ADMIN_USER_IDS=admin;
    await pool.query('INSERT INTO auth.users VALUES($1),($2)',[admin,user]);
    await pool.query("INSERT INTO users.profiles VALUES($1,'param','Param')",[user]);
    await pool.query("INSERT INTO poi.countries VALUES($1,'India')",[city]);
    await pool.query("INSERT INTO media.assets(id,uploaded_by,mime_type,is_public) VALUES($1,$2,'image/png',true),($3,$4,'image/jpeg',false)",[icon,admin,evidence,user]);
    await pool.query("INSERT INTO poi.cities(id,name,country_id,icon_asset_id) VALUES($1,'Noida',$1,$2)",[city,icon]);
    await pool.query("INSERT INTO poi.places(id,name,city_id,country_id) VALUES($1,'Temple',$2,$2)",[place,city]);
    await pool.query('INSERT INTO users.collection(id,user_id,city_id,verification_asset_id) VALUES($1,$2,$3,$4)',[submission,user,city,evidence]);
  });
  test('authentication and explicit allowlist guard every route, including evidence',async()=>{
    for(const [method,path,body] of [['get',''],['get',`/CITY/${submission}`],['get',`/CITY/${submission}/evidence`],['post',`/CITY/${submission}/review`,review()]]){
      expect((await api(method,path,body,null)).status).toBe(401);
      expect((await api(method,path,body,user)).status).toBe(403);
    }
    delete process.env.VISIT_REVIEW_ADMIN_USER_IDS;expect((await api('get')).status).toBe(403);
    process.env.VISIT_REVIEW_ADMIN_USER_IDS=`${admin},invalid`;expect((await api('get')).status).toBe(403);expect(media).not.toHaveBeenCalled();
  });
  test('queue/detail show private evidence URL without storage keys and evidence delivery uses submission owner',async()=>{
    const list=await api('get');expect(list.status).toBe(200);expect(list.body.data.verifications).toHaveLength(1);
    const detail=await api('get',`/CITY/${submission}`);expect(detail.body.data.verification.user.username).toBe('param');expect(JSON.stringify(detail.body)).not.toContain('storage_key');
    expect((await api('get',`/CITY/${submission}/evidence`)).status).toBe(200);expect(media).toHaveBeenCalledWith({assetId:evidence,viewerUserId:user});
  });
  test('CITY approval audits, attaches the icon, preserves unselected profile state, and is idempotent',async()=>{
    const approved=await api('post',`/CITY/${submission}/review`,review());expect(approved.status).toBe(200);expect(approved.body.data.updated).toBe(true);
    const row=(await pool.query('SELECT * FROM users.collection WHERE id=$1',[submission])).rows[0];expect(row).toMatchObject({verification_status:true,review_status:'VERIFIED',icon_asset_id:icon,is_preference:false});
    expect(await profileCollections()).toEqual([]);
    const again=await api('post',`/CITY/${submission}/review`,review());expect(again.body.data.updated).toBe(false);
    expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(1);
    expect((await api('post',`/CITY/${submission}/review`,review('REJECTED',{reason:'different'}))).status).toBe(409);
    const userDetail=await userRepo.findVerificationById({userId:user,verificationId:submission});expect(mapper.toVerificationDetail(userDetail)).toMatchObject({status:'VERIFIED',review:{decision:'VERIFIED'}});
    const preference=await userRepo.updateCollectionPreference({userId:user,collectionId:submission,isPreference:true});expect(preference.is_preference).toBe(true);
    expect((await profileCollections())[0].icon.id).toBe(icon);
  });
  test('user verification list and detail expose the correct city or place coordinates',async()=>{
    await pool.query('UPDATE poi.cities SET latitude=28.5355,longitude=77.3910 WHERE id=$1',[city]);
    await pool.query('UPDATE poi.places SET latitude=28.5001,longitude=77.4002 WHERE id=$1',[place]);
    const placeVisit=await addPlace();
    const list=await userRepo.listVerifications({userId:user});
    const cityEntry=mapper.toVerificationDetail(list.rows.find(r=>r.target_type==='CITY'));
    const placeEntry=mapper.toVerificationDetail(list.rows.find(r=>r.target_type==='PLACE'));
    expect(cityEntry.location).toMatchObject({latitude:28.5355,longitude:77.391});
    expect(placeEntry.location).toMatchObject({latitude:28.5001,longitude:77.4002});
    for(const [id,expected] of [[submission,cityEntry.location],[placeVisit,placeEntry.location]]){
      const detail=await userRepo.findVerificationById({userId:user,verificationId:id});
      expect(mapper.toVerificationDetail(detail).location).toEqual(expected);
      expect(await userRepo.findVerificationById({userId:admin,verificationId:id})).toBeNull();
    }
    await pool.query('UPDATE poi.cities SET latitude=NULL,longitude=NULL');
    await pool.query('UPDATE poi.places SET latitude=0,longitude=0');
    const nullCity=await userRepo.findVerificationById({userId:user,verificationId:submission});
    const zeroPlace=await userRepo.findVerificationById({userId:user,verificationId:placeVisit});
    expect(mapper.toVerificationDetail(nullCity).location).toMatchObject({latitude:null,longitude:null});
    expect(mapper.toVerificationDetail(zeroPlace).location).toMatchObject({latitude:0,longitude:0});
  });
  test('CITY rejection is visible to its user and new evidence resets to pending without losing audit history',async()=>{
    expect((await api('post',`/CITY/${submission}/review`,review('REJECTED',{reason:'Not enough evidence'}))).status).toBe(200);
    const rows=await userRepo.listVerifications({userId:user});expect(rows.rows[0].verification_status).toBe('REJECTED');
    expect(mapper.toVerificationDetail(rows.rows[0]).review.reason).toBe('Not enough evidence');
    expect((await pool.query('SELECT verification_status FROM users.collection WHERE id=$1',[submission])).rows[0].verification_status).toBe(false);
    const next=randomUUID();await pool.query("INSERT INTO media.assets(id,uploaded_by,mime_type,is_public) VALUES($1,$2,'image/jpeg',false)",[next,user]);
    await userRepo.savePendingCity({client:pool,userId:user,cityId:city,verificationAssetId:next});
    expect((await repo.detail('CITY',submission)).status).toBe('PENDING');
    expect((await api('post',`/CITY/${submission}/review`,review())).body.code).toBe('VISIT_REVIEW.STALE_EVIDENCE');
    expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(1);
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{evidenceAssetId:next}))).status).toBe(200);
    expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(2);
  });
  test('PLACE rejection is listed, while approval verifies the city; container is not a duplicate queue entry',async()=>{
    const id=await addPlace();expect((await api('get')).body.data.verifications.map(v=>v.targetType)).toEqual(['PLACE']);
    expect((await api('post',`/PLACE/${id}/review`,review('REJECTED',{reason:'Wrong photo'}))).status).toBe(200);
    expect((await userRepo.listVerifications({userId:user})).rows.some(r=>r.target_type==='PLACE'&&r.verification_status==='REJECTED')).toBe(true);
    // Separate pending place evidence; rejection must never revoke an independently verified city.
    await pool.query("UPDATE users.visited_places SET verification_status='PENDING' WHERE id=$1",[id]);
    await pool.query('DELETE FROM users.visit_verification_reviews');
    expect((await api('post',`/PLACE/${id}/review`,review())).status).toBe(200);
    expect((await pool.query('SELECT verification_status FROM users.collection WHERE id=$1',[submission])).rows[0].verification_status).toBe(true);
  });
  test('missing icon fails without audit/state changes; reviewer-owned public override permits approval',async()=>{
    await pool.query('UPDATE poi.cities SET icon_asset_id=NULL');
    expect((await api('post',`/CITY/${submission}/review`,review())).body.code).toBe('VISIT_REVIEW.ICON_REQUIRED');
    expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(0);
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{iconAssetId:icon}))).status).toBe(200);
    const selected=await userRepo.updateCollectionPreference({userId:user,collectionId:submission,isPreference:true});
    expect(selected.icon_asset_id).toBe(icon);
    expect(mapper.toPreferenceResponse(selected).collection.city.icon.id).toBe(icon);
    expect((await profileCollections())[0].icon.id).toBe(icon);
  });
  test('private/deleted/foreign icon overrides are rejected',async()=>{
    await pool.query('UPDATE media.assets SET is_public=false WHERE id=$1',[icon]);
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{iconAssetId:icon}))).status).toBe(409);
    await pool.query('UPDATE media.assets SET is_public=true,uploaded_by=$2 WHERE id=$1',[icon,user]);
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{iconAssetId:icon}))).status).toBe(409);
    await pool.query('UPDATE media.assets SET uploaded_by=$2,deleted_at=now() WHERE id=$1',[icon,admin]);
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{iconAssetId:icon}))).status).toBe(409);
  });
  test('competing decisions serialize to one audit and one final result',async()=>{
    const responses=await Promise.all([api('post',`/CITY/${submission}/review`,review()),api('post',`/CITY/${submission}/review`,review('REJECTED',{reason:'No'}))]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,409]);expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(1);
  });
  test('audit failure rolls back all approval writes',async()=>{
    failAudit=true;expect((await api('post',`/CITY/${submission}/review`,review())).status).toBe(500);
    expect((await repo.detail('CITY',submission)).status).toBe('PENDING');expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(0);
  });
  test('rejects self-review, missing evidence, stale evidence and already automatic-verified records',async()=>{
    process.env.VISIT_REVIEW_ADMIN_USER_IDS=user;expect((await api('post',`/CITY/${submission}/review`,review(),user)).status).toBe(403);process.env.VISIT_REVIEW_ADMIN_USER_IDS=admin;
    expect((await api('post',`/CITY/${submission}/review`,review('VERIFIED',{evidenceAssetId:randomUUID()}))).status).toBe(409);
    await pool.query('UPDATE media.assets SET deleted_at=now() WHERE id=$1',[evidence]);expect((await api('post',`/CITY/${submission}/review`,review())).status).toBe(409);
    await pool.query('UPDATE media.assets SET deleted_at=NULL WHERE id=$1',[evidence]);await pool.query('UPDATE users.collection SET verification_status=true WHERE id=$1',[submission]);
    expect((await api('post',`/CITY/${submission}/review`,review())).status).toBe(409);
  });
  test('validates decisions, IDs, rejection reasons and cursor before changes',async()=>{
    for(const body of [review('APPROVED'),{decision:'VERIFIED'},review('REJECTED'),review('VERIFIED',{userId:user})])expect((await api('post',`/CITY/${submission}/review`,body)).status).toBe(400);
    expect((await api('get','?cursor=bad')).status).toBe(400);expect((await api('get','/CITY/not-a-uuid')).status).toBe(400);
  });
  test('cursor pagination with equal timestamps does not repeat submissions',async()=>{
    const second=randomUUID();await pool.query('INSERT INTO users.collection(id,user_id,city_id,verification_asset_id) VALUES($1,$2,$3,$4)',[second,admin,city,evidence]);
    await pool.query("UPDATE users.collection SET created_at='2026-11-19 10:00:00.123456+00'");
    const first=(await api('get','?limit=1')).body.data;expect(first.pagination.hasMore).toBe(true);
    const next=(await api('get',`?limit=1&cursor=${first.pagination.nextCursor}`)).body.data;expect(next.verifications[0].id).not.toBe(first.verifications[0].id);expect(next.pagination.hasMore).toBe(false);
  });
  test('existing five-city preference limit is preserved after manual approval',async()=>{
    await api('post',`/CITY/${submission}/review`,review());
    for(let i=0;i<5;i++)await pool.query('INSERT INTO users.collection(id,user_id,city_id,verification_status,is_preference) VALUES($1,$2,$3,true,true)',[randomUUID(),user,randomUUID()]);
    await expect(userRepo.updateCollectionPreference({userId:user,collectionId:submission,isPreference:true})).rejects.toMatchObject({code:'23514'});
  });
  test('rejecting a place does not revoke an existing verified preferred city',async()=>{
    await pool.query('UPDATE users.collection SET verification_status=true,icon_asset_id=$2,is_preference=true WHERE id=$1',[submission,icon]);
    const id=await addPlace();await api('post',`/PLACE/${id}/review`,review('REJECTED',{reason:'Wrong photo'}));
    expect((await pool.query('SELECT verification_status,is_preference FROM users.collection WHERE id=$1',[submission])).rows[0]).toEqual({verification_status:true,is_preference:true});
  });
  test('automatic camera verification with new evidence clears an earlier manual rejection',async()=>{
    await api('post',`/CITY/${submission}/review`,review('REJECTED',{reason:'Old evidence'}));
    const fresh=randomUUID();
    await pool.query("INSERT INTO media.assets(id,uploaded_by,mime_type,is_public) VALUES($1,$2,'image/jpeg',false)",[fresh,user]);
    await pool.query('UPDATE users.collection SET verification_asset_id=$2,verification_status=true WHERE id=$1',[submission,fresh]);
    const row=await repo.detail('CITY',submission);expect(row.status).toBe('VERIFIED');expect(row.details).toEqual({});
    expect((await pool.query('SELECT * FROM users.visit_verification_reviews')).rows).toHaveLength(1);
  });
});
