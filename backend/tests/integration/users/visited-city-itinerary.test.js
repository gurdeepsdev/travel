import {jest} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';

let directory,pool,user,other,city,foreignCity,place,failSave=false;
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const c=await pool.connect();try{
    await c.query('BEGIN');const value=await fn({query:(sql,args)=>{
      if(failSave&&sql.includes('UPDATE itinerary.visited_city_drafts'))throw Error('simulated write failure');
      return c.query(sql,args);
    }});await c.query('COMMIT');return value;
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js',()=>({default:{authenticate:(req,res,next)=>{
  const id=req.get('Authorization')?.replace('Bearer ','');if(!id)return res.sendStatus(401);req.user={id};next();
}}}));
const {default:routes}=await import('../../../src/modules/itinerary/visited-city/visited-city.routes.js');
const {default:itineraries}=await import('../../../src/modules/itinerary/itinerary.repository.js');
const app=express();app.use(express.json());app.use('/users',routes);
app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code??'INTERNAL'}));
function api(method='get',suffix='',body,actor=user,target=city){
  const req=request(app)[method](`/users/me/visited-cities/${target}/itinerary-draft${suffix}`);
  if(actor)req.set('Authorization','Bearer '+actor);return body===undefined?req:req.send(body);
}
const metadata={year:2020,month:5,tripType:'FAMILY'};
async function add(count=1){let result;for(let i=0;i<count;i++)result=await api('post','/attractions',{name:'Attraction '+i});return result;}
async function rows(table){return (await pool.query('SELECT * FROM '+table)).rows;}

(process.env.RUN_VISITED_ITINERARY_DB_TESTS==='1'?describe:describe.skip)('visited-city drafts on isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-visited-itinerary-');
    execFileSync('initdb',['-D',directory+'/data','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',directory+'/data','-l',directory+'/pg.log','-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:'postgres'});
    await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA media;CREATE SCHEMA poi;CREATE SCHEMA users;CREATE SCHEMA itinerary;CREATE SCHEMA groups;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE media.assets(id uuid PRIMARY KEY);
      CREATE TABLE poi.cities(id uuid PRIMARY KEY,name text,is_active boolean DEFAULT true);
      CREATE TABLE poi.places(id uuid PRIMARY KEY,city_id uuid,name text,description text,address text,latitude float8,longitude float8,is_active boolean DEFAULT true);
      CREATE TABLE users.collection(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,city_id uuid,verification_status boolean DEFAULT false,UNIQUE(user_id,city_id));
      CREATE TABLE groups.groups(id uuid PRIMARY KEY,itinerary_id uuid,status text,deleted_at timestamptz);
      CREATE TABLE groups.group_members(group_id uuid,user_id uuid,status text);`);
    for(const file of ['017_create_itineraries.sql','018_create_itinerary_items.sql'])await pool.query(readFileSync(new URL('../../../src/database/migrations/'+file,import.meta.url),'utf8'));
    await pool.query(`CREATE TABLE itinerary.user_itinerary_states(itinerary_id uuid REFERENCES itinerary.itineraries(id),user_id uuid,status text NOT NULL DEFAULT 'PLANNED',completed_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(itinerary_id,user_id));`);
    const migration=readFileSync(new URL('../../../src/database/migrations/069_add_personal_itinerary_state.sql',import.meta.url),'utf8');
    await pool.query(migration.slice(migration.indexOf('CREATE FUNCTION itinerary.initialize_owner_state()'),migration.indexOf('CREATE FUNCTION itinerary.sync_group_personal_states')));
    await pool.query(readFileSync(new URL('../../../src/database/migrations/096_visited_city_itinerary_drafts.sql',import.meta.url),'utf8'));
  },30000);
  afterAll(async()=>{await pool?.end();if(directory){try{execFileSync('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{
    failSave=false;
    await pool.query('TRUNCATE itinerary.visited_city_drafts,itinerary.user_itinerary_states,itinerary.itineraries,users.collection,poi.places,poi.cities,auth.users CASCADE');
    [user,other,city,foreignCity,place]=Array.from({length:5},randomUUID);
    await pool.query('INSERT INTO auth.users VALUES($1),($2)',[user,other]);
    await pool.query("INSERT INTO poi.cities(id,name) VALUES($1,'Agra'),($2,'Delhi')",[city,foreignCity]);
    await pool.query('INSERT INTO users.collection(user_id,city_id,verification_status) VALUES($1,$2,true)',[user,city]);
    await pool.query("INSERT INTO poi.places(id,city_id,name,description,address,latitude,longitude) VALUES($1,$2,'Taj Mahal','Marble monument','Agra',27.17,78.04)",[place,city]);
  });
  test('all endpoints require authentication and per-user approved city',async()=>{
    for(const [method,path,body] of [['get',''],['patch','',metadata],['post','/attractions',{name:'Taj'}],['patch',`/attractions/${place}`,{name:'Taj'}],['delete',`/attractions/${place}`],['post','/complete',metadata]]){
      expect((await api(method,path,body,null)).status).toBe(401);
      expect((await api(method,path,body,other)).status).toBe(403);
    }
    await pool.query('UPDATE users.collection SET verification_status=false');
    expect((await api()).status).toBe(403);expect(await rows('itinerary.visited_city_drafts')).toHaveLength(0);
  });
  test('GET does not create a draft or itinerary',async()=>{
    expect((await api()).body.data.draft).toBeNull();expect(await rows('itinerary.visited_city_drafts')).toHaveLength(0);
  });
  test('three attractions persist without generating an itinerary, with partial metadata updates',async()=>{
    await add(3);await api('patch','',metadata);await api('patch','',{title:'My Agra memories'});
    const r=await api();expect(r.body.data.draft).toMatchObject({...metadata,title:'My Agra memories',status:'DRAFT',itineraryId:null});
    expect(r.body.data.draft.attractions).toHaveLength(3);expect(await rows('itinerary.itineraries')).toHaveLength(0);
  });
  test.each([[1,[1]],[3,[3]],[4,[4]],[5,[4,1]],[8,[4,4]],[9,[4,4,1]]])('completion partitions %i attractions correctly',async(count,sizes)=>{
    await add(count);const result=await api('post','/complete',metadata);expect(result.status).toBe(200);
    const i=result.body.data.itinerary;expect(i).toMatchObject({ownerId:user,visibility:'private',tripStatus:'completed',aiGenerated:false,durationDays:sizes.length});
    expect(i.itineraryJson.days.map(d=>d.items.length)).toEqual(sizes);
    expect(i.itineraryJson.summary).toMatchObject({num_days:sizes.length,total_places:count});
    expect(i.itineraryJson).toMatchObject({visit_year:2020,visit_month:5,trip_type:'FAMILY',mode:'past'});
    expect((await rows('itinerary.user_itinerary_states'))[0].status).toBe('COMPLETED');
    expect((await itineraries.findAccessibleById({itineraryId:i.id,userId:user})).trip_status).toBe('completed');
    expect(await itineraries.findAccessibleById({itineraryId:i.id,userId:other})).toBeNull();
  });
  test('existing POI snapshot is city-scoped and has the canonical generated item shape',async()=>{
    const r=await api('post','/attractions',{placeId:place});expect(r.status).toBe(200);
    const a=r.body.data.draft.attractions[0];expect(a).toMatchObject({placeId:place,name:'Taj Mahal',position:1});
    const result=await api('post','/complete',metadata);
    expect(result.body.data.itinerary.itineraryJson.days[0].items[0]).toMatchObject({item_type:'poi',place_id:place,name:'Taj Mahal',latitude:27.17,longitude:78.04});
  });
  test('inactive, missing and foreign-city POIs fail without altering the draft',async()=>{
    expect((await api('post','/attractions',{placeId:randomUUID()})).status).toBe(404);
    await pool.query('UPDATE poi.places SET city_id=$1',[foreignCity]);
    expect((await api('post','/attractions',{placeId:place})).status).toBe(404);
    await pool.query('UPDATE poi.places SET city_id=$1,is_active=false',[city]);
    expect((await api('post','/attractions',{placeId:place})).status).toBe(404);
    expect(await rows('itinerary.visited_city_drafts')).toHaveLength(0);
  });
  test('duplicate POI is rejected, update can replace, reorder and delete only owned draft items',async()=>{
    const a=(await api('post','/attractions',{placeId:place})).body.data.draft.attractions[0];
    expect((await api('post','/attractions',{placeId:place})).status).toBe(409);
    const b=(await api('post','/attractions',{name:'Fort'})).body.data.draft.attractions[1];
    expect((await api('patch','/attractions/'+b.id,{placeId:place})).status).toBe(409);
    const updated=await api('patch','/attractions/'+b.id,{name:'Agra Fort',position:1});
    expect(updated.body.data.draft.attractions[0]).toMatchObject({id:b.id,name:'Agra Fort',position:1});
    expect((await api('patch','/attractions/'+b.id,{position:3})).status).toBe(400);
    expect((await api('delete','/attractions/'+a.id)).body.data.draft.attractions).toHaveLength(1);
    expect((await api('delete','/attractions/'+a.id)).status).toBe(404);
  });
  test('another verified user has an independent draft and cannot edit the first user items',async()=>{
    await pool.query('INSERT INTO users.collection(user_id,city_id,verification_status) VALUES($1,$2,true)',[other,city]);
    const r=await add();const id=r.body.data.draft.attractions[0].id;
    expect((await api('delete','/attractions/'+id,undefined,other)).status).toBe(404);
    expect((await api('get','',undefined,other)).body.data.draft).toBeNull();
    expect((await api()).body.data.draft.attractions).toHaveLength(1);
  });
  test('empty and incomplete drafts cannot complete; future visits fail validation',async()=>{
    expect((await api('post','/complete',metadata)).body.code).toBe('VISITED_ITINERARY.EMPTY_DRAFT');
    await add();expect((await api('post','/complete',{})).body.code).toBe('VISITED_ITINERARY.METADATA_REQUIRED');
    expect((await api('post','/complete',{...metadata,year:9999})).body.code).toBe('VISITED_ITINERARY.FUTURE_VISIT');
    expect(await rows('itinerary.itineraries')).toHaveLength(0);
  });
  test('completion is idempotent and locks all subsequent draft changes',async()=>{
    const a=(await add()).body.data.draft.attractions[0];
    const first=await api('post','/complete',metadata);const next=await api('post','/complete',{title:'Ignored on retry'});
    expect(next.body.data.created).toBe(false);expect(next.body.data.itinerary.id).toBe(first.body.data.itinerary.id);
    for(const [method,path,body] of [['patch','',{title:'No'}],['post','/attractions',{name:'No'}],['delete','/attractions/'+a.id],['patch','/attractions/'+a.id,{name:'No'}]])expect((await api(method,path,body)).status).toBe(409);
    expect(await rows('itinerary.itineraries')).toHaveLength(1);
  });
  test('parallel completion produces one itinerary and no lost concurrent attraction additions',async()=>{
    const adds=await Promise.all(Array.from({length:5},(_,i)=>api('post','/attractions',{name:'Concurrent '+i})));
    expect(adds.every(r=>r.status===200)).toBe(true);
    const results=await Promise.all([api('post','/complete',metadata),api('post','/complete',metadata)]);
    expect(results.map(r=>r.status)).toEqual([200,200]);
    expect(new Set(results.map(r=>r.body.data.itinerary.id)).size).toBe(1);
    expect(results[0].body.data.itinerary.itineraryJson.summary.total_places).toBe(5);
    expect(await rows('itinerary.itineraries')).toHaveLength(1);
  });
  test('completion failure rolls back itinerary, state and draft changes',async()=>{
    await add();failSave=true;expect((await api('post','/complete',metadata)).status).toBe(500);failSave=false;
    expect(await rows('itinerary.itineraries')).toHaveLength(0);expect(await rows('itinerary.user_itinerary_states')).toHaveLength(0);
    expect((await api()).body.data.draft).toMatchObject({status:'DRAFT',year:null,itineraryId:null});
  });
  test('attraction quota enforced without data loss',async()=>{
    await add();const draft=(await rows('itinerary.visited_city_drafts'))[0];
    const attractions=Array.from({length:200},(_,i)=>({id:randomUUID(),name:'Item '+i}));
    await pool.query('UPDATE itinerary.visited_city_drafts SET attractions=$1 WHERE id=$2',[JSON.stringify(attractions),draft.id]);
    expect((await add()).body.code).toBe('VISITED_ITINERARY.ATTRACTION_LIMIT');
    expect((await api()).body.data.draft.attractions).toHaveLength(200);
  });
  test('invalid bodies, UUIDs and coordinate pairs are rejected',async()=>{
    for(const body of [{},{name:''},{name:'x'.repeat(256)},{name:'Taj',userId:other},{name:'Taj',latitude:91}])expect((await api('post','/attractions',body)).status).toBe(400);
    expect((await api('post','/attractions',{name:'Taj',latitude:20})).status).toBe(400);
    expect((await api('patch','',{})).status).toBe(400);
    expect((await api('patch','',{month:13})).status).toBe(400);
    expect((await api('patch','',{tripType:'BAD'})).status).toBe(400);
    expect((await api('get','',undefined,user,'bad')).status).toBe(400);
  });
  test('revoked verification or inactive city blocks completion and leaves the draft intact',async()=>{
    await add(3);await pool.query('UPDATE poi.cities SET is_active=false WHERE id=$1',[city]);
    expect((await api('post','/complete',metadata)).status).toBe(403);
    await pool.query('UPDATE poi.cities SET is_active=true WHERE id=$1',[city]);
    await pool.query('UPDATE users.collection SET verification_status=false');
    expect((await api('post','/complete',metadata)).status).toBe(403);
    expect(await rows('itinerary.itineraries')).toHaveLength(0);
    expect((await rows('itinerary.visited_city_drafts'))[0].attractions).toHaveLength(3);
  });
  test('saved metadata permits empty completion body and original city/approval rows are preserved',async()=>{
    const beforeCity=await rows('poi.cities'),beforeApproval=await rows('users.collection');
    await add(3);await api('patch','',metadata);
    const result=await api('post','/complete');expect(result.status).toBe(200);
    expect(result.body.data.itinerary.itineraryJson.days[0].items).toHaveLength(3);
    expect(await rows('poi.cities')).toEqual(beforeCity);expect(await rows('users.collection')).toEqual(beforeApproval);
  });
  test('normal itinerary creation retains existing public, AI and planned behavior',async()=>{
    await add();await api('post','/complete',metadata);
    const normal=await itineraries.create({userId:user,title:'Normal generated trip',durationDays:1,itineraryJson:{days:[]}});
    expect(normal).toMatchObject({visibility:'public',ai_generated:true,trip_status:'planned'});
    const states=await pool.query('SELECT status FROM itinerary.user_itinerary_states WHERE itinerary_id=$1',[normal.id]);
    expect(states.rows[0].status).toBe('PLANNED');
  });
  test('title allocation preserves existing itineraries and deleted completed itinerary is not regenerated',async()=>{
    await pool.query("INSERT INTO itinerary.itineraries(created_by,title) VALUES($1,'Agra itinerary')",[user]);
    await add();const r=await api('post','/complete',metadata);expect(r.body.data.itinerary.title).toBe('Agra itinerary 01');
    await pool.query('UPDATE itinerary.itineraries SET deleted_at=now() WHERE id=$1',[r.body.data.itinerary.id]);
    expect((await api('post','/complete',{})).body.code).toBe('VISITED_ITINERARY.ITINERARY_UNAVAILABLE');
    expect(await rows('itinerary.itineraries')).toHaveLength(2);
  });
});
