import {jest} from '@jest/globals';
import {createHmac} from 'node:crypto';
import {createFcmSender,classifyPushFailure,pushConfiguration} from '../../../src/modules/notifications/notification-fcm.service.js';
const row={token:'private-device-token',notification_id:'11111111-1111-4111-8111-111111111111',type:'POST_COMMENT_RECEIVED',target:{type:'POST',id:'22222222-2222-4222-8222-222222222222'}};
beforeEach(()=>{process.env.NOTIFICATION_FCM_PROJECT_ID='artictern-7a286';process.env.NOTIFICATION_FCM_CREDENTIALS_FILE='/private/firebase.json';});
afterEach(()=>{delete process.env.NOTIFICATION_FCM_PROJECT_ID;delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;delete process.env.NOTIFICATION_RELAY_URL;delete process.env.NOTIFICATION_RELAY_SECRET;});
test('relay signs exact body and never loads Firebase credentials on VPS',async()=>{
  process.env.NOTIFICATION_RELAY_URL='https://relay.example/send';process.env.NOTIFICATION_RELAY_SECRET='a'.repeat(64);
  delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;
  const Auth=jest.fn(),http={post:jest.fn().mockResolvedValue({status:200})};
  await createFcmSender({Auth,http})(row);
  expect(Auth).not.toHaveBeenCalled();
  const [url,body,config]=http.post.mock.calls[0];
  expect(url).toBe(process.env.NOTIFICATION_RELAY_URL);
  expect(JSON.parse(body).notificationId).toBe(row.notification_id);
  expect(config.headers['X-Relay-Signature']).toBe(createHmac('sha256',process.env.NOTIFICATION_RELAY_SECRET).update(`${config.headers['X-Relay-Timestamp']}\nPOST\n/send\n${body}`).digest('hex'));
  expect(config.maxRedirects).toBe(0);
});
test('relay fails closed on insecure URL or missing secret, without key-file fallback',()=>{
  process.env.NOTIFICATION_RELAY_URL='http://relay.example/send';process.env.NOTIFICATION_RELAY_SECRET='a'.repeat(64);
  expect(pushConfiguration).toThrow();
  process.env.NOTIFICATION_RELAY_URL='https://relay.example/send';delete process.env.NOTIFICATION_RELAY_SECRET;
  expect(pushConfiguration).toThrow();
});
test('HTTP v1 uses the configured project, private credential file and safe navigation payload',async()=>{
  const getAccessToken=jest.fn().mockResolvedValue('private-oauth-token');
  const Auth=jest.fn(function(){this.getAccessToken=getAccessToken;});const http={post:jest.fn().mockResolvedValue({status:200})};
  const send=createFcmSender({Auth,http});await send(row);await send(row);
  expect(Auth).toHaveBeenCalledTimes(1);
  expect(Auth).toHaveBeenCalledWith({keyFile:'/private/firebase.json',scopes:['https://www.googleapis.com/auth/firebase.messaging']});
  const [url,payload,config]=http.post.mock.calls[0];
  expect(url).toBe('https://fcm.googleapis.com/v1/projects/artictern-7a286/messages:send');
  expect(payload.message.data).toEqual({notificationId:row.notification_id,type:row.type,targetType:'POST',targetId:row.target.id});
  expect(payload.message.notification).toEqual({title:'Artictern',body:'Open Artictern to view your update.'});
  expect(config).toMatchObject({timeout:5000,maxRedirects:0,headers:{Authorization:'Bearer private-oauth-token'}});
});
test('missing/invalid project and credentials fail closed',()=>{
  delete process.env.NOTIFICATION_FCM_PROJECT_ID;expect(pushConfiguration).toThrow();
  process.env.NOTIFICATION_FCM_PROJECT_ID='https://invalid.example';expect(pushConfiguration).toThrow();
  process.env.NOTIFICATION_FCM_PROJECT_ID='artictern-7a286';delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;expect(pushConfiguration).toThrow();
});
test('an OAuth timeout cannot leave a sender hanging',async()=>{
  jest.useFakeTimers();
  try{
    const Auth=jest.fn(function(){this.getAccessToken=()=>new Promise(()=>{});});
    const post=jest.fn(),promise=createFcmSender({Auth,http:{post}})(row);
    const assertion=expect(promise).rejects.toMatchObject({code:'FCM_AUTH_TIMEOUT'});
    await jest.advanceTimersByTimeAsync(10000);await assertion;expect(post).not.toHaveBeenCalled();
  }finally{jest.useRealTimers();}
});
test('rate limits honor numeric and date Retry-After, never immediate retries',()=>{
  expect(classifyPushFailure({response:{status:429,headers:{'retry-after':'600'}}},1).retrySeconds).toBeGreaterThanOrEqual(600);
  const now=Date.now();expect(classifyPushFailure({response:{status:503,headers:{'retry-after':new Date(now+600000).toUTCString()}}},1,now).retrySeconds).toBeGreaterThanOrEqual(599);
});
test('only typed UNREGISTERED errors disable devices, not arbitrary 400 responses',()=>{
  const error={response:{status:404,data:{error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}}}};
  expect(classifyPushFailure(error,1)).toMatchObject({code:'UNREGISTERED',unregistered:true,terminal:true});
  expect(classifyPushFailure({response:{status:400}},1)).toMatchObject({unregistered:false,terminal:true});
  expect(classifyPushFailure(Error('private-token'),5)).toMatchObject({code:'FCM_SEND_FAILED',terminal:true});
  expect(classifyPushFailure(Error('private-token'),1)).toMatchObject({code:'FCM_SEND_FAILED',terminal:false});
});
