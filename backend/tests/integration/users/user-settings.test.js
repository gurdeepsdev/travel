import {jest} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';
let directory,pool,user,other;
const config={NODE_ENV:'uat'};
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}};
jest.unstable_mockModule('../../../src/config/env.js',()=>({default:config}));
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js',()=>({default:{authenticate:(req,res,next)=>{
  const id=req.get('Authorization')==='Bearer user'?user:req.get('Authorization')==='Bearer other'?other:null;
  if(!id)return res.status(401).json({success:false});req.user={id};next();
}}}));
const {default:routes}=await import('../../../src/modules/users/settings/user-settings.routes.js');
const {patchSettingsSchema}=await import('../../../src/modules/users/settings/user-settings.validation.js');
const app=express();app.use(express.json());app.use('/users',routes);
app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code}));
const entry=(key='theme',type='string',value='dark')=>({key,type,value});
const api=(method,body,account='user')=>{
  const req=request(app)[method]('/users/me/settings').set('Authorization',`Bearer ${account}`);
  return body===undefined?req:req.send(body);
};

describe('settings strict typed validation',()=>{
  const parse=settings=>patchSettingsSchema.safeParse({params:{},query:{},body:{settings}}).success;
  test('accepts dynamically named scalar settings',()=>expect(parse([entry(),entry('count','number',1.5),entry('enabled','boolean',false)])).toBe(true));
  test.each([
    [entry('theme','boolean','false')],[entry('theme','number','1')],[entry('theme','string',null)],
    [entry('theme','object',{})],[entry('theme','number',Infinity)],[entry('__proto__')],[entry('constructor')],
    [entry('bad key')],[entry(),entry()],[entry('theme','string','x'.repeat(2049))],[],
  ])('rejects malformed entries %j',(...settings)=>expect(parse(settings)).toBe(false));
});

(process.env.RUN_SETTINGS_DB_TESTS==='1'?describe:describe.skip)('settings API on isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-settings-');
    execFileSync('initdb',['-D',`${directory}/data`,'--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',`${directory}/data`,'-l',`${directory}/pg.log`,'-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:'postgres'});
    await pool.query('CREATE SCHEMA auth;CREATE SCHEMA users;CREATE TABLE auth.users(id uuid PRIMARY KEY);');
    await pool.query(readFileSync(new URL('../../../src/database/migrations/007_create_user_settings.sql',import.meta.url),'utf8'));
  },30000);
  afterAll(async()=>{await pool?.end();if(directory){try{execFileSync('pg_ctl',['-D',`${directory}/data`,'-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{config.NODE_ENV='uat';await pool.query('TRUNCATE auth.users CASCADE');user=randomUUID();other=randomUUID();await pool.query('INSERT INTO auth.users VALUES($1),($2)',[user,other]);});
  test('GET and PATCH require authentication',async()=>{
    expect((await request(app).get('/users/me/settings')).status).toBe(401);
    expect((await request(app).patch('/users/me/settings').send({settings:[entry()]})).status).toBe(401);
  });
  test('new user gets an empty list without inserting a row',async()=>{
    expect((await api('get')).body.data.settings).toEqual([]);
    expect((await pool.query('SELECT * FROM users.user_settings')).rows).toHaveLength(0);
  });
  test('UAT auto-creates keys, partially merges and isolates accounts',async()=>{
    const response=await api('patch',{settings:[entry(),entry('autoplay','boolean',false)]});expect(response.status).toBe(200);
    expect((await api('patch',{settings:[entry('theme','string','light')]})).body.data.settings).toEqual([entry('autoplay','boolean',false),entry('theme','string','light')]);
    expect((await api('get',undefined,'other')).body.data.settings).toEqual([]);
    expect((await api('get')).body.data.settings).toHaveLength(2);
  });
  test('existing legacy settings survive typed settings updates',async()=>{
    await pool.query('INSERT INTO users.user_settings(user_id,settings_json) VALUES($1,$2)',[user,JSON.stringify({legacy:{keep:true}})]);
    await api('patch',{settings:[entry()]});
    expect((await pool.query('SELECT settings_json FROM users.user_settings WHERE user_id=$1',[user])).rows[0].settings_json.legacy).toEqual({keep:true});
  });
  test('parallel first writes preserve both independently added keys',async()=>{
    const responses=await Promise.all([api('patch',{settings:[entry('one')]}),api('patch',{settings:[entry('two')]})]);
    expect(responses.map(r=>r.status)).toEqual([200,200]);expect((await api('get')).body.data.settings).toHaveLength(2);
  });
  test.each(['production','development','test','UAT',''])('unknown keys fail closed outside exact uat (%s)',async mode=>{
    await api('patch',{settings:[entry()]});config.NODE_ENV=mode;
    const response=await api('patch',{settings:[entry('newKey')]});expect(response.status).toBe(400);expect(response.body.code).toBe('SETTINGS.KEY_NOT_APPROVED');
    expect((await api('get')).body.data.settings).toEqual([]);
    const stored=(await pool.query('SELECT settings_json FROM users.user_settings WHERE user_id=$1',[user])).rows[0].settings_json;
    expect(stored.appSettingsV1.newKey).toBeUndefined();
  });
  test('rejects caller-selected identity, unknown body fields and mismatched types',async()=>{
    for(const body of [{settings:[entry()],userId:other},{settings:[entry('flag','boolean','false')]},{settings:[entry(),entry()]}])expect((await api('patch',body)).status).toBe(400);
    expect((await pool.query('SELECT * FROM users.user_settings')).rows).toHaveLength(0);
  });
  test('key quota is atomic and existing keys can still be updated',async()=>{
    for(let batch=0;batch<2;batch++)expect((await api('patch',{settings:Array.from({length:50},(_,i)=>entry(`key${batch*50+i}`))})).status).toBe(200);
    expect((await api('patch',{settings:[entry('extra')]})).body.code).toBe('SETTINGS.LIMIT_EXCEEDED');
    expect((await api('get')).body.data.settings).toHaveLength(100);
    expect((await api('patch',{settings:[entry('key0','number',123)]})).status).toBe(200);
  });
});
