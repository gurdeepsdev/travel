import {jest} from '@jest/globals';
import {createHmac} from 'node:crypto';
const post=jest.fn(),getAccessToken=jest.fn(),transaction=jest.fn(),error=jest.fn();
const Auth=jest.fn(function(){this.getAccessToken=getAccessToken;});
jest.unstable_mockModule('axios',()=>({default:{post}}));
jest.unstable_mockModule('google-auth-library',()=>({GoogleAuth:Auth}));
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:{transaction}}));
jest.unstable_mockModule('../../../src/core/logger/logger.js',()=>({default:{error,warn:jest.fn()}}));
const {sendChatPush,chatPushConfiguration,processChatPush,startChatPushWorker,stopChatPushWorker}=await import('../../../src/realtime/chat-push.worker.js');
const keys=['CHAT_RELAY_URL','CHAT_RELAY_SECRET','NOTIFICATION_RELAY_URL','NOTIFICATION_RELAY_SECRET','CHAT_FCM_PROJECT_ID','CHAT_FCM_CREDENTIALS_FILE','CHAT_PUSH_ENABLED'];
const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const row={token:'private-device-token',conversation_id:'11111111-1111-4111-8111-111111111111',message_id:'22222222-2222-4222-8222-222222222222',event_id:'9007199254740993'};
beforeEach(()=>{jest.clearAllMocks();for(const k of keys)delete process.env[k];post.mockResolvedValue({status:200});getAccessToken.mockResolvedValue('private-oauth');});
afterEach(()=>{stopChatPushWorker();for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];});
test('chat signs a relay payload with unchanged navigation IDs and no Firebase key on VPS',async()=>{
  process.env.CHAT_RELAY_URL='https://relay.example/send';process.env.CHAT_RELAY_SECRET='a'.repeat(64);
  await sendChatPush(row);expect(Auth).not.toHaveBeenCalled();expect(getAccessToken).not.toHaveBeenCalled();
  const [url,body,config]=post.mock.calls[0];expect(url).toBe(process.env.CHAT_RELAY_URL);
  expect(JSON.parse(body)).toEqual({kind:'CHAT',token:row.token,conversationId:row.conversation_id,messageId:row.message_id,eventId:row.event_id});
  expect(config.headers['X-Relay-Signature']).toBe(createHmac('sha256',process.env.CHAT_RELAY_SECRET).update(`${config.headers['X-Relay-Timestamp']}\nPOST\n/send\n${body}`).digest('hex'));
  expect(config).toMatchObject({timeout:15000,maxRedirects:0});
});
test('chat can share the general relay configuration without enabling general push',async()=>{
  process.env.NOTIFICATION_RELAY_URL='https://shared.example/send';process.env.NOTIFICATION_RELAY_SECRET='b'.repeat(64);
  await sendChatPush(row);expect(post.mock.calls[0][0]).toBe(process.env.NOTIFICATION_RELAY_URL);expect(Auth).not.toHaveBeenCalled();
});
test.each(['http://relay.example/send','https://user:pass@relay.example/send','https://relay.example/send?x=1','https://relay.example/other'])('invalid relay %s never falls back to direct credentials',async(url)=>{
  process.env.CHAT_RELAY_URL=url;process.env.CHAT_RELAY_SECRET='a'.repeat(64);process.env.CHAT_FCM_PROJECT_ID='artictern-7a286';process.env.CHAT_FCM_CREDENTIALS_FILE='/private/key.json';
  await expect(sendChatPush(row)).rejects.toMatchObject({code:'FCM_CONFIGURATION'});expect(post).not.toHaveBeenCalled();expect(Auth).not.toHaveBeenCalled();
});
test('missing relay secret fails closed before network or OAuth',async()=>{
  process.env.CHAT_RELAY_URL='https://relay.example/send';expect(chatPushConfiguration).toThrow();
  await expect(sendChatPush(row)).rejects.toMatchObject({code:'FCM_CONFIGURATION'});expect(post).not.toHaveBeenCalled();
});
test('direct chat FCM transport and payload remain unchanged when relay is absent',async()=>{
  process.env.CHAT_FCM_PROJECT_ID='artictern-7a286';process.env.CHAT_FCM_CREDENTIALS_FILE='/private/chat.json';
  await sendChatPush(row);
  expect(Auth).toHaveBeenCalledWith({keyFile:'/private/chat.json',scopes:['https://www.googleapis.com/auth/firebase.messaging']});
  expect(post).toHaveBeenCalledWith('https://fcm.googleapis.com/v1/projects/artictern-7a286/messages:send',{message:{token:row.token,notification:{title:'New message',body:'Open Artictern to view it.'},data:{conversationId:row.conversation_id,messageId:row.message_id,eventId:row.event_id}}},expect.objectContaining({timeout:5000,maxRedirects:0}));
});
test('disabled push never starts a timer, queries or sends despite configured relay',async()=>{
  process.env.NOTIFICATION_RELAY_URL='https://relay.example/send';process.env.NOTIFICATION_RELAY_SECRET='a'.repeat(64);
  const timer=jest.spyOn(global,'setInterval');try{startChatPushWorker();await processChatPush();expect(timer).not.toHaveBeenCalled();expect(transaction).not.toHaveBeenCalled();expect(post).not.toHaveBeenCalled();}finally{timer.mockRestore();}
});
test('enabled but unconfigured sender does not claim jobs or consume retries',async()=>{
  process.env.CHAT_PUSH_ENABLED='true';await processChatPush();expect(transaction).not.toHaveBeenCalled();expect(error).toHaveBeenCalledWith({code:'FCM_CONFIGURATION'},expect.any(String));
});
