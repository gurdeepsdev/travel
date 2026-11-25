import { jest } from '@jest/globals';
import pg from 'pg';
import express from 'express';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { userInfo } from 'node:os';
import { randomUUID } from 'node:crypto';

let directory,pool,user,other,actor,session,failJournal=false,migrationPreserved;
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const result=await fn({query:(sql,args)=>{
    if(failJournal&&sql.includes('INSERT INTO notification.event_outbox'))throw Error('journal unavailable');
    return client.query(sql,args);
  }});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
jest.unstable_mockModule('../../../src/core/logger/logger.js',()=>({default:{error:jest.fn(),warn:jest.fn()}}));
jest.unstable_mockModule('../../../src/realtime/realtime-server.js',()=>({emitUserEvent:jest.fn()}));
jest.unstable_mockModule('../../../src/middleware/auth.middleware.js',()=>({default:{authenticate:(req,res,next)=>{
  if(req.headers.authorization!=='Bearer test')return res.status(401).json({success:false});
  req.user={id:user};req.session={id:session};next();
}}}));
const {default:repository}=await import('../../../src/modules/notifications/notification.repository.js');
const {default:router}=await import('../../../src/modules/notifications/notification.routes.js');
const {processNotificationOutbox}=await import('../../../src/realtime/notification-outbox.worker.js');
const {processNotificationPush}=await import('../../../src/realtime/notification-push.worker.js');
const app=express();app.use(express.json());app.use('/api/v1/notifications',router);
app.use((error,_req,res,_next)=>res.status(error.statusCode??500).json({code:error.code??'INTERNAL',message:error.message}));
const input=(extra={})=>({userId:user,actorId:actor,eventKey:randomUUID(),type:'POST_COMMENT_RECEIVED',title:'New comment',body:'Someone commented on your post.',target:{type:'POST',id:randomUUID()},...extra});
const create=value=>db.transaction(client=>repository.createInTransaction(client,value??input()));
const api=(method,path='')=>request(app)[method](`/api/v1/notifications${path}`).set('Authorization','Bearer test');

(process.env.RUN_NOTIFICATION_DB_TESTS==='1'?describe:describe.skip)('notification foundation on isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-notifications-');
    execFileSync('initdb',['-D',`${directory}/data`,'--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',`${directory}/data`,'-l',`${directory}/pg.log`,'-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:'postgres'});
    await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA chat;CREATE SCHEMA users;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,status text NOT NULL);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,expires_at timestamp NOT NULL);
      CREATE TABLE users.blocked_users(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,blocked_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE)`);
    const chatMigration=readFileSync(new URL('../../../src/database/migrations/077_chat_inbox_notifications.sql',import.meta.url),'utf8');
    await pool.query(chatMigration.slice(chatMigration.indexOf('CREATE TABLE chat.push_devices ('),chatMigration.indexOf('CREATE TABLE chat.push_outbox (')));
    await pool.query(readFileSync(new URL('../../../src/database/migrations/093_notification_foundation.sql',import.meta.url),'utf8'));
    const seededUser=randomUUID(),seededSession=randomUUID(),seededDevice=randomUUID();
    await pool.query("INSERT INTO auth.users VALUES($1,'ACTIVE')",[seededUser]);
    await pool.query("INSERT INTO auth.sessions VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '1 day')",[seededSession,seededUser]);
    await pool.query("INSERT INTO chat.push_devices(id,user_id,session_id,platform,token,token_hash) VALUES($1,$2,$3,'android','migration-test-token','migration-test-hash')",[seededDevice,seededUser,seededSession]);
    const snapshot=async()=>{const result={};for(const table of ['auth.users','auth.sessions','chat.push_devices','notification.notifications','notification.preferences','notification.event_outbox'])result[table]=(await pool.query(`SELECT to_jsonb(t) AS value FROM ${table} t`)).rows;return JSON.stringify(result);};
    const beforeMigration=await snapshot();
    await pool.query(readFileSync(new URL('../../../src/database/migrations/094_notification_push_delivery.sql',import.meta.url),'utf8'));
    migrationPreserved=beforeMigration===await snapshot();
  },30000);
  afterAll(async()=>{await pool?.end();if(directory){try{execFileSync('pg_ctl',['-D',`${directory}/data`,'-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{
    failJournal=false;
    delete process.env.NOTIFICATION_PUSH_ENABLED;
    await pool.query('TRUNCATE auth.users CASCADE');
    [user,other,actor]=[randomUUID(),randomUUID(),randomUUID()];
    for(const id of [user,other,actor])await pool.query("INSERT INTO auth.users VALUES($1,'ACTIVE')",[id]);
    session=randomUUID();await pool.query("INSERT INTO auth.sessions VALUES($1,$2,CURRENT_TIMESTAMP+INTERVAL '1 day')",[session,user]);
  });
  afterEach(()=>{delete process.env.NOTIFICATION_PUSH_ENABLED;delete process.env.NOTIFICATION_FCM_PROJECT_ID;delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;delete process.env.NOTIFICATION_RELAY_URL;delete process.env.NOTIFICATION_RELAY_SECRET;});
  test('migration 094 preserves pre-existing users, sessions, registrations and foundation tables',()=>{expect(migrationPreserved).toBe(true);});
  test('server producer creates exactly one owned notification and outbox event',async()=>{
    const result=await create();expect(result.created).toBe(true);
    const res=await api('get');expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.notifications[0]).toMatchObject({id:result.notification.id,type:'POST_COMMENT_RECEIVED',category:'EXPLORE',priority:'NORMAL',actorId:actor,readAt:null});
    expect(res.body.data.notifications[0]).not.toHaveProperty('event_key');
    expect((await api('get','/unread-count')).body.data).toEqual({unreadCount:1});
    expect((await repository.list(other,{limit:20})).notifications).toEqual([]);
    expect((await pool.query('SELECT * FROM notification.event_outbox')).rows).toHaveLength(1);
  });
  test('concurrent duplicate delivery creates one notification/event per recipient',async()=>{
    const value=input();const results=await Promise.all(Array.from({length:10},()=>create(value)));
    expect(results.filter(v=>v.created)).toHaveLength(1);
    expect((await pool.query('SELECT * FROM notification.event_outbox')).rows).toHaveLength(1);
    expect((await create({...value,userId:other})).created).toBe(true);
  });
  test('business rollback and journal failure cannot leave a notification behind',async()=>{
    await expect(db.transaction(async client=>{await repository.createInTransaction(client,input());throw Error('business failed');})).rejects.toThrow('business failed');
    failJournal=true;await expect(create()).rejects.toThrow('journal unavailable');
    expect((await pool.query('SELECT * FROM notification.notifications')).rows).toEqual([]);
    expect((await pool.query('SELECT * FROM notification.event_outbox')).rows).toEqual([]);
  });
  test('self, nonexistent and inactive recipients are suppressed',async()=>{
    expect((await create(input({actorId:user}))).created).toBe(false);
    expect((await create(input({userId:randomUUID()}))).created).toBe(false);
    await pool.query("UPDATE auth.users SET status='INACTIVE' WHERE id=$1",[user]);
    expect((await create()).created).toBe(false);
  });
  test('read is owned, idempotent and emits one read-state event',async()=>{
    const {notification}=await create();
    await expect(repository.read(other,notification.id)).rejects.toMatchObject({statusCode:404});
    expect((await api('put',`/${notification.id}/read`)).body.data.updated).toBe(true);
    expect((await api('put',`/${notification.id}/read`)).body.data.updated).toBe(false);
    expect((await api('get','/unread-count')).body.data.unreadCount).toBe(0);
    expect((await api('get','?unreadOnly=true')).body.data.notifications).toEqual([]);
    expect((await pool.query("SELECT * FROM notification.event_outbox WHERE event_type='notification.read'")).rows).toHaveLength(1);
  });
  test('read all affects only caller history, leaving subsequent notifications unread',async()=>{
    await create();await create();await create(input({userId:other}));
    expect((await api('put','/read-all')).body.data.updatedCount).toBe(2);
    expect((await api('put','/read-all')).body.data.updatedCount).toBe(0);
    await create();expect(await repository.unread(user)).toEqual({unreadCount:1});
    expect(await repository.unread(other)).toEqual({unreadCount:1});
  });
  test('read update and event roll back together',async()=>{
    const {notification}=await create();failJournal=true;
    await expect(repository.read(user,notification.id)).rejects.toThrow('journal unavailable');
    await expect(repository.readAll(user)).rejects.toThrow('journal unavailable');
    expect(await repository.unread(user)).toEqual({unreadCount:1});
  });
  test('microsecond cursor order and unread filter do not duplicate rows',async()=>{
    const ids=[];for(let i=0;i<4;i++)ids.push((await create()).notification.id);
    await pool.query("UPDATE notification.notifications SET created_at='2026-10-28 12:00:00.123456+00'");
    const page=await repository.list(user,{limit:2});
    const cursor=JSON.parse(Buffer.from(page.pagination.nextCursor,'base64url').toString());
    expect(cursor.createdAt).toContain('.123456');
    const next=await repository.list(user,{limit:2,cursor:page.pagination.nextCursor});
    expect(new Set([...page.notifications,...next.notifications].map(n=>n.id)).size).toBe(4);
    expect(next.pagination.hasMore).toBe(false);
    await repository.read(user,ids[0]);expect((await repository.list(user,{limit:10,unreadOnly:true})).notifications).toHaveLength(3);
  });
  test('preferences merge partial fields and honor channel-only event policy',async()=>{
    expect((await api('get','/preferences')).body.data.preferences).toHaveLength(10);
    expect((await api('patch','/preferences').send({preferences:[{category:'EXPLORE',push:false}]})).status).toBe(200);
    await repository.updatePreferences(user,[{category:'EXPLORE',inApp:false}]);
    expect((await repository.preferences(user)).preferences.find(p=>p.category==='EXPLORE')).toEqual({category:'EXPLORE',inApp:false,push:false});
    const value=input();await create(value);
    expect((await repository.list(user,{limit:20})).notifications).toEqual([]);
    await repository.updatePreferences(user,[{category:'EXPLORE',inApp:true,push:true}]);
    expect((await create(value)).created).toBe(false);
    await create(input({type:'PLACE_PHOTO_VERIFIED'}));
    expect((await repository.list(user,{limit:20})).notifications).toEqual([]);
    expect((await pool.query("SELECT in_app,push FROM notification.notifications WHERE type='PLACE_PHOTO_VERIFIED'")).rows[0]).toEqual({in_app:false,push:true});
    await expect(create(input({type:'CUSTOM_DOCUMENT_REMINDER'}))).rejects.toMatchObject({statusCode:409});
    await expect(create(input({type:'APP_UPDATE_REQUIRED'}))).rejects.toMatchObject({statusCode:409});
  });
  test('outbox emits only to owner, retries transport errors, and suppresses inactive users',async()=>{
    const {notification}=await create();const emit=jest.fn().mockRejectedValueOnce(Error('offline'));
    await processNotificationOutbox(emit);
    expect((await pool.query('SELECT attempts,completed_at FROM notification.event_outbox')).rows[0]).toMatchObject({attempts:1,completed_at:null});
    await pool.query('UPDATE notification.event_outbox SET next_attempt_at=clock_timestamp()');
    emit.mockResolvedValue(undefined);await processNotificationOutbox(emit);
    expect(emit).toHaveBeenLastCalledWith(user,'notification.created',expect.objectContaining({eventId:expect.any(String),notification:expect.objectContaining({id:notification.id})}));
    await processNotificationOutbox(emit);expect(emit).toHaveBeenCalledTimes(2);
    await repository.read(user,notification.id);await processNotificationOutbox(emit);
    expect(emit).toHaveBeenLastCalledWith(user,'notification.read',expect.objectContaining({notificationId:notification.id,all:false}));
    await create();await pool.query("UPDATE auth.users SET status='INACTIVE' WHERE id=$1",[user]);
    emit.mockClear();await processNotificationOutbox(emit);expect(emit).not.toHaveBeenCalled();
  });
  test.each([['get',''],['get','/unread-count'],['get','/preferences'],['patch','/preferences'],['put','/read-all'],['put','/11111111-1111-4111-8111-111111111111/read']])('%s %s requires authentication',async(method,path)=>{
    expect((await request(app)[method](`/api/v1/notifications${path}`)).status).toBe(401);
  });
  test('validation rejects malformed IDs, cursors, duplicate categories and untrusted fields',async()=>{
    expect((await api('put','/invalid/read')).status).toBe(400);
    expect((await api('get','?cursor=invalid')).status).toBe(400);
    expect((await api('get','?limit=51')).status).toBe(400);
    expect((await api('get','?unreadOnly=anything')).status).toBe(400);
    for(const preferences of [[{category:'FAKE',push:true}],[{category:'EXPLORE'}],[{category:'EXPLORE',push:true},{category:'EXPLORE',push:false}]])
      expect((await api('patch','/preferences').send({preferences})).status).toBe(400);
    expect((await api('put','/read-all').send({userId:other})).status).toBe(400);
    expect((await api('post').send(input())).status).toBe(404);
  });
  const enablePush=()=>{
    process.env.NOTIFICATION_PUSH_ENABLED='true';process.env.NOTIFICATION_FCM_PROJECT_ID='artictern-7a286';
    process.env.NOTIFICATION_FCM_CREDENTIALS_FILE='/not-used-by-mock-sender/firebase.json';
  };
  const register=async()=>{
    const deviceId=randomUUID();
    const response=await api('put','/push-devices').send({deviceId,platform:'android',token:`dummy-fcm-token-${randomUUID()}`});
    expect(response.status).toBe(200);expect(response.body.data).toEqual({deviceId,registered:true});return deviceId;
  };
  test('generic device endpoints share registry, enforce ownership and never return tokens',async()=>{
    const deviceId=await register();
    const response=await api('put','/push-devices').send({deviceId,platform:'ios',token:`rotated-dummy-token-${randomUUID()}`});
    expect(response.status).toBe(200);
    expect((await pool.query('SELECT platform FROM chat.push_devices WHERE id=$1',[deviceId])).rows[0].platform).toBe('ios');
    const previous=user;user=other;
    expect((await api('put','/push-devices').send({deviceId,platform:'android',token:`other-dummy-token-${randomUUID()}`})).status).toBe(409);
    await api('delete',`/push-devices/${deviceId}`);
    expect((await pool.query('SELECT * FROM chat.push_devices WHERE id=$1',[deviceId])).rows).toHaveLength(1);
    user=previous;expect((await api('delete',`/push-devices/${deviceId}`)).body.data).toEqual({deviceId,registered:false});
    expect((await api('put','/push-devices').send({deviceId,platform:'web',token:'short'})).status).toBe(400);
  });
  test('push enqueues per registered device once and FCM runs outside a DB transaction',async()=>{
    enablePush();await register();await register();
    const value=input();await create(value);await create(value);
    expect((await pool.query('SELECT * FROM notification.push_outbox')).rows).toHaveLength(2);
    const send=jest.fn().mockImplementation(async()=>{
      const {rows}=await pool.query("SELECT COUNT(*) FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'");
      expect(Number(rows[0].count)).toBe(0);
    });
    await processNotificationPush(send);expect(send).toHaveBeenCalledTimes(2);
    await processNotificationPush(send);expect(send).toHaveBeenCalledTimes(2);
    expect((await pool.query('SELECT completed_at,failure_code FROM notification.push_outbox')).rows.every(r=>r.completed_at&&r.failure_code===null)).toBe(true);
  });
  test.each(['read','preference','session','account','blocked','expired','device','logout'])('dispatch suppresses %s changes after enqueue',async reason=>{
    enablePush();const deviceId=await register();const {notification}=await create();
    if(reason==='read')await repository.read(user,notification.id);
    if(reason==='preference')await repository.updatePreferences(user,[{category:'EXPLORE',push:false}]);
    if(reason==='session')await pool.query("UPDATE auth.sessions SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 day'");
    if(reason==='account')await pool.query("UPDATE auth.users SET status='INACTIVE' WHERE id=$1",[user]);
    if(reason==='blocked')await pool.query('INSERT INTO users.blocked_users VALUES($1,$2)',[user,actor]);
    if(reason==='expired')await pool.query("UPDATE notification.push_outbox SET expires_at=clock_timestamp()-INTERVAL '1 second'");
    if(reason==='device')await pool.query('UPDATE chat.push_devices SET enabled=false');
    if(reason==='logout')await api('delete',`/push-devices/${deviceId}`);
    const send=jest.fn();await processNotificationPush(send);expect(send).not.toHaveBeenCalled();
  });
  test('disabled push and chat types never enqueue; transaction rollback removes queued pushes',async()=>{
    await register();await create();expect((await pool.query('SELECT * FROM notification.push_outbox')).rows).toEqual([]);
    enablePush();await create(input({type:'DIRECT_MESSAGE_RECEIVED'}));expect((await pool.query('SELECT * FROM notification.push_outbox')).rows).toEqual([]);
    await expect(db.transaction(async client=>{await repository.createInTransaction(client,input());throw Error('rollback');})).rejects.toThrow('rollback');
    expect((await pool.query('SELECT * FROM notification.push_outbox')).rows).toEqual([]);
  });
  test('transient FCM errors retry with Retry-After and terminal token errors disable only the matching token',async()=>{
    enablePush();const deviceId=await register();await create();
    await processNotificationPush(jest.fn().mockRejectedValue({response:{status:429,headers:{'retry-after':'600'}}}));
    let row=(await pool.query('SELECT * FROM notification.push_outbox')).rows[0];
    expect(row.attempts).toBe(1);expect(row.completed_at).toBeNull();
    expect(new Date(row.next_attempt_at).getTime()-Date.now()).toBeGreaterThan(590000);
    await pool.query('UPDATE notification.push_outbox SET next_attempt_at=clock_timestamp()');
    await processNotificationPush(jest.fn().mockRejectedValue({response:{status:404,data:{error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}}}}));
    row=(await pool.query('SELECT * FROM notification.push_outbox')).rows[0];expect(row.completed_at).not.toBeNull();expect(row.failure_code).toBe('UNREGISTERED');
    expect((await pool.query('SELECT enabled FROM chat.push_devices WHERE id=$1',[deviceId])).rows[0].enabled).toBe(false);
  });
  test('a rotating token is not disabled by an old-token FCM error',async()=>{
    enablePush();const deviceId=await register();await create();
    await processNotificationPush(async()=>{
      await api('put','/push-devices').send({deviceId,platform:'android',token:`new-dummy-token-${randomUUID()}`});
      throw {response:{status:404,data:{error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}}}};
    });
    expect((await pool.query('SELECT enabled FROM chat.push_devices WHERE id=$1',[deviceId])).rows[0].enabled).toBe(true);
  });
  test('five failed attempts complete a push and a crashed final attempt cannot trigger a sixth send',async()=>{
    enablePush();await register();await create();await pool.query('UPDATE notification.push_outbox SET attempts=4');
    const send=jest.fn().mockRejectedValue(Error('transient'));await processNotificationPush(send);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await pool.query('SELECT attempts,completed_at FROM notification.push_outbox')).rows[0]).toMatchObject({attempts:5,completed_at:expect.any(Date)});
    await pool.query('UPDATE notification.push_outbox SET completed_at=NULL');
    send.mockClear();await processNotificationPush(send);expect(send).not.toHaveBeenCalled();
  });
  test('configuration failures do not consume attempts; expired leases are recoverable',async()=>{
    enablePush();await register();await create();delete process.env.NOTIFICATION_FCM_PROJECT_ID;
    const send=jest.fn();await processNotificationPush(send);expect(send).not.toHaveBeenCalled();
    expect((await pool.query('SELECT attempts FROM notification.push_outbox')).rows[0].attempts).toBe(0);
    enablePush();await pool.query("UPDATE notification.push_outbox SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+INTERVAL '1 minute'");
    await processNotificationPush(send);expect(send).not.toHaveBeenCalled();
    await pool.query("UPDATE notification.push_outbox SET lease_until=clock_timestamp()-INTERVAL '1 second'");
    await processNotificationPush(send);expect(send).toHaveBeenCalledTimes(1);
  });
  test.each([['put','/push-devices'],['delete','/push-devices/11111111-1111-4111-8111-111111111111']])('%s %s requires authentication',async(method,path)=>{
    expect((await request(app)[method](`/api/v1/notifications${path}`)).status).toBe(401);
  });
  test('keyless relay configuration dispatches through the generic worker without credential files',async()=>{
    process.env.NOTIFICATION_PUSH_ENABLED='true';process.env.NOTIFICATION_RELAY_URL='https://relay.example/send';process.env.NOTIFICATION_RELAY_SECRET='a'.repeat(64);
    delete process.env.NOTIFICATION_FCM_PROJECT_ID;delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;
    await register();await create();const send=jest.fn().mockResolvedValue();
    await processNotificationPush(send);expect(send).toHaveBeenCalledTimes(1);
    const row=(await pool.query('SELECT attempts,completed_at,failure_code FROM notification.push_outbox')).rows[0];
    expect(row).toMatchObject({attempts:1,completed_at:expect.any(Date),failure_code:null});
  });
  test('disabling generic push after enqueue leaves jobs untouched and sends nothing',async()=>{
    enablePush();await register();await create();delete process.env.NOTIFICATION_PUSH_ENABLED;
    const before=(await pool.query('SELECT * FROM notification.push_outbox')).rows;
    const send=jest.fn();await processNotificationPush(send);expect(send).not.toHaveBeenCalled();
    expect((await pool.query('SELECT * FROM notification.push_outbox')).rows).toEqual(before);
  });
});
