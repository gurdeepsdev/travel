import {jest} from '@jest/globals';
import pg from 'pg';
import express from 'express';
import request from 'supertest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';

let directory,client,user,other,current,older,expired,boundary;
const query=jest.fn((...args)=>client.query(...args));
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{query}}));
const {default:repository}=await import('../../../src/modules/auth/repositories/sessions.repository.js');
const {default:sessionService}=await import('../../../src/modules/auth/services/session.service.js');
jest.unstable_mockModule('../../../src/modules/auth/auth.service.js',()=>({default:{getSessions:input=>sessionService.getSessions(input)}}));
const {default:controller}=await import('../../../src/modules/auth/auth.controller.js');
const app=express();
app.get('/auth/sessions',(req,_res,next)=>{req.user={id:user};req.session={id:current};next();},controller.getSessions);
app.use((error,_req,res,_next)=>res.status(500).json({message:error.message}));

(process.env.RUN_SESSION_LIST_DB_TESTS==='1'?describe:describe.skip)('active session listing on isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-session-list-');
    execFileSync('initdb',['-D',directory+'/data','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',directory+'/data','-l',directory+'/pg.log','-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    client=new pg.Client({host:directory,user:userInfo().username,database:'postgres'});await client.connect();
    await client.query(`CREATE SCHEMA auth;CREATE TABLE auth.sessions(
      id uuid PRIMARY KEY,user_id uuid NOT NULL,refresh_token_hash text NOT NULL,
      device_name text,device_type text,ip_address text,user_agent text,
      expires_at timestamp NOT NULL,created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  },30000);
  afterAll(async()=>{await client?.end();if(directory){try{execFileSync('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{
    [user,other,current,older,expired,boundary]=Array.from({length:6},randomUUID);
    await client.query('BEGIN');await client.query('TRUNCATE auth.sessions');
    await client.query(`INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at,created_at,device_name,device_type) VALUES
      ($1,$5,'private-test-hash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '1 day',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),'Current phone','mobile'),
      ($2,$5,'private-test-hash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '2 days',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 day','Other phone','mobile'),
      ($3,$5,'private-test-hash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '1 second',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '2 days',NULL,NULL),
      ($4,$5,'private-test-hash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')-interval '3 days',NULL,NULL),
      ($6,$7,'private-test-hash',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+interval '1 day',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),NULL,NULL)`,
    [current,older,expired,boundary,user,randomUUID(),other]);query.mockClear();
  });
  afterEach(async()=>{await client.query('ROLLBACK');});
  test('excludes expired and exactly-expiring sessions while retaining every unexpired session newest first',async()=>{
    const rows=await repository.findByUserId(user);expect(rows.map(s=>s.id)).toEqual([current,older]);
  });
  test('real controller response preserves current flag and metadata without exposing refresh hashes',async()=>{
    const response=await request(app).get('/auth/sessions');expect(response.status).toBe(200);
    expect(response.body.data.sessions.map(s=>({id:s.id,current:s.current}))).toEqual([{id:current,current:true},{id:older,current:false}]);
    expect(response.body.data.sessions[0]).toMatchObject({deviceName:'Current phone',deviceType:'mobile'});
    expect(JSON.stringify(response.body)).not.toContain('private-test-hash');
    expect(JSON.stringify(response.body)).not.toContain('refresh_token_hash');
  });
  test('listing is read-only and does not revoke, delete or refresh any session',async()=>{
    const before=(await client.query('SELECT * FROM auth.sessions ORDER BY id')).rows;
    await repository.findByUserId(user);await request(app).get('/auth/sessions');
    expect(query.mock.calls.every(([sql])=>/^\s*SELECT\b/i.test(sql))).toBe(true);
    expect((await client.query('SELECT * FROM auth.sessions ORDER BY id')).rows).toEqual(before);
  });
  test('UTC expiry comparison is independent of database session timezone',async()=>{
    await client.query("SET LOCAL TIME ZONE 'Asia/Kolkata'");
    expect((await repository.findByUserId(user)).map(s=>s.id)).toEqual([current,older]);
    await client.query("SET LOCAL TIME ZONE 'America/Los_Angeles'");
    expect((await repository.findByUserId(user)).map(s=>s.id)).toEqual([current,older]);
  });
  test('returns an empty collection for a user with no unexpired sessions',async()=>{
    await client.query('UPDATE auth.sessions SET expires_at=(CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') WHERE user_id=$1',[user]);
    expect(await repository.findByUserId(user)).toEqual([]);
    expect((await request(app).get('/auth/sessions')).body.data.sessions).toEqual([]);
  });
  test('sessions belonging to another account are never returned',async()=>{
    const rows=await repository.findByUserId(other);expect(rows).toHaveLength(1);expect(rows[0].user_id).toBe(other);
    expect(await repository.findByUserId(randomUUID())).toEqual([]);
  });
  test('find-by-ID behavior remains unchanged for authentication and explicit revocation',async()=>{
    expect((await repository.findBySessionId(current)).id).toBe(current);
    expect((await repository.findBySessionId(expired)).id).toBe(expired);
    expect((await repository.findBySessionId(boundary)).id).toBe(boundary);
  });
});
