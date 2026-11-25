import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createRelay} from './server.js';
import {createFcmSender,sendRelayPayload} from '../../backend/src/modules/notifications/notification-fcm.service.js';

const secret='a'.repeat(64),project='artictern-7a286';
const input={token:'device-token-not-for-logging',notificationId:'11111111-1111-4111-8111-111111111111',type:'POST_COMMENT_RECEIVED',target:{type:'POST',id:'22222222-2222-4222-8222-222222222222'}};
async function fixture(t,http){
  let authCalls=0;
  const server=createRelay({secret,project,auth:{getAccessToken:async()=>{authCalls++;return 'private-oauth';}},http});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {url:`http://127.0.0.1:${server.address().port}/send`,authCalls:()=>authCalls,send:async({body=JSON.stringify(input),timestamp=String(Date.now()),signature}={})=>fetch(`http://127.0.0.1:${server.address().port}/send`,{method:'POST',headers:{'X-Relay-Timestamp':timestamp,'X-Relay-Signature':signature||createHmac('sha256',secret).update(`${timestamp}\nPOST\n/send\n${body}`).digest('hex')},body})};
}
test('authenticated delivery uses ADC and fixed privacy-safe payload',async t=>{
  let sent;
  const f=await fixture(t,async(url,options)=>{sent={url,options};return new Response('{}',{status:200});});
  assert.equal((await f.send()).status,200);
  assert.equal(f.authCalls(),1);
  assert.equal(JSON.parse(sent.options.body).message.notification.body,'Open Artictern to view your update.');
  assert.equal(sent.options.redirect,'error');
});
test('bad signature, expired timestamp and invalid payload never contact Firebase',async t=>{
  const f=await fixture(t,()=>{throw Error('Must not send');});
  assert.equal((await f.send({signature:'0'.repeat(64)})).status,401);
  assert.equal((await f.send({timestamp:String(Date.now()-120000)})).status,401);
  assert.equal((await f.send({body:'{'})).status,400);
  assert.equal((await f.send({body:JSON.stringify({...input,token:''})})).status,400);
  assert.equal(f.authCalls(),0);
});
test('only typed UNREGISTERED propagates token invalidation; errors are sanitized',async t=>{
  const f=await fixture(t,async()=>new Response(JSON.stringify({error:{message:'secret-provider-data',details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}}),{status:404}));
  const response=await f.send();assert.equal(response.status,404);
  const text=await response.text();assert.match(text,/UNREGISTERED/);assert.doesNotMatch(text,/secret-provider-data/);
});
test('FCM rate limits propagate retry delay and remain retryable',async t=>{
  const f=await fixture(t,async()=>new Response('{}',{status:429,headers:{'retry-after':'600'}}));
  const response=await f.send();assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'600');
});
test('upstream network failure returns a sanitized retryable response',async t=>{
  const f=await fixture(t,async()=>{throw Error('private-token');});
  const response=await f.send();assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-token/);
});
test('missing relay configuration fails at startup',()=>{assert.throws(()=>createRelay({project}));});
test('chat relay preserves the existing string navigation payload with fixed privacy text',async t=>{
  let sent;
  const f=await fixture(t,async(_url,options)=>{sent=JSON.parse(options.body);return new Response('{}',{status:200});});
  const chat={kind:'CHAT',token:input.token,conversationId:input.notificationId,messageId:input.target.id,eventId:'9007199254740993'};
  assert.equal((await f.send({body:JSON.stringify(chat)})).status,200);
  assert.deepEqual(sent.message,{token:chat.token,notification:{title:'New message',body:'Open Artictern to view it.'},data:{conversationId:chat.conversationId,messageId:chat.messageId,eventId:chat.eventId}});
});
test('chat rejects unknown kind and invalid identifiers before ADC or Firebase',async t=>{
  const f=await fixture(t,()=>{throw Error('Must not send');});
  const chat={kind:'CHAT',token:input.token,conversationId:input.notificationId,messageId:input.target.id,eventId:'123'};
  for(const value of [{...chat,kind:'OTHER'},{...chat,conversationId:'invalid'},{...chat,messageId:'invalid'},{...chat,eventId:123},{...chat,eventId:'-1'}])
    assert.equal((await f.send({body:JSON.stringify(value)})).status,400);
  assert.equal(f.authCalls(),0);
});
test('tampered signed request and oversized body never authorize Firebase',async t=>{
  const f=await fixture(t,()=>{throw Error('Must not send');});
  const timestamp=String(Date.now());
  const signature=createHmac('sha256',secret).update(`${timestamp}\nPOST\n/send\n{}`).digest('hex');
  assert.equal((await f.send({timestamp,signature,body:JSON.stringify(input)})).status,401);
  assert.equal((await f.send({body:'x'.repeat(8193)})).status,413);
  assert.equal(f.authCalls(),0);
});
test('backend generic and chat signatures interoperate with the relay over real local HTTP',async t=>{
  const sent=[];
  const f=await fixture(t,async(_url,options)=>{sent.push(JSON.parse(options.body));return new Response('{}',{status:200});});
  const keys=['NOTIFICATION_RELAY_URL','NOTIFICATION_RELAY_SECRET','NOTIFICATION_FCM_CREDENTIALS_FILE'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];});
  process.env.NOTIFICATION_RELAY_URL='https://relay.example/send';process.env.NOTIFICATION_RELAY_SECRET=secret;delete process.env.NOTIFICATION_FCM_CREDENTIALS_FILE;
  // Only the test adapter redirects the approved HTTPS URL to this isolated HTTP server.
  const http={post:async(url,body,config)=>{
    assert.equal(url,'https://relay.example/send');
    const r=await fetch(f.url,{method:'POST',headers:config.headers,body});assert.equal(r.status,200);
  }};
  const Auth=function(){throw Error('VPS must not load Firebase credentials');};
  await createFcmSender({Auth,http})({token:input.token,notification_id:input.notificationId,type:input.type,target:input.target});
  await sendRelayPayload({relayUrl:process.env.NOTIFICATION_RELAY_URL,relaySecret:secret},{kind:'CHAT',token:input.token,conversationId:input.notificationId,messageId:input.target.id,eventId:'123'},http);
  assert.equal(sent.length,2);assert.equal(f.authCalls(),2);
  assert.equal(sent[0].message.data.notificationId,input.notificationId);assert.equal(sent[1].message.data.eventId,'123');
});
