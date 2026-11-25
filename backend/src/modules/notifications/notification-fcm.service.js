import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import { createHmac } from 'node:crypto';

export const pushEnabled=()=>process.env.NOTIFICATION_PUSH_ENABLED==='true';
export function relayConfiguration(relayUrl,relaySecret) {
  let url;try{url=new URL(relayUrl);}catch{}
  if(!url||url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/send'||typeof relaySecret!=='string'||relaySecret.length<64)
    throw Object.assign(new Error('Notification relay configuration invalid.'),{code:'FCM_CONFIGURATION'});
  return {relayUrl,relaySecret};
}
export async function sendRelayPayload(configuration,payload,http=axios) {
  const {relayUrl,relaySecret}=configuration;
  const body=JSON.stringify(payload),timestamp=String(Date.now());
  const signature=createHmac('sha256',relaySecret).update(`${timestamp}\nPOST\n/send\n${body}`).digest('hex');
  await http.post(relayUrl,body,{headers:{'Content-Type':'application/json','X-Relay-Timestamp':timestamp,'X-Relay-Signature':signature},timeout:15000,maxRedirects:0});
}
export function pushConfiguration() {
  const project=process.env.NOTIFICATION_FCM_PROJECT_ID?.trim();
  const keyFile=process.env.NOTIFICATION_FCM_CREDENTIALS_FILE?.trim();
  const relayUrl=process.env.NOTIFICATION_RELAY_URL?.trim();
  const relaySecret=process.env.NOTIFICATION_RELAY_SECRET;
  if(relayUrl){
    return relayConfiguration(relayUrl,relaySecret);
  }
  if(!project||!keyFile||!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project))
    throw Object.assign(new Error('Notification Firebase configuration missing or invalid.'),{code:'FCM_CONFIGURATION'});
  return {project,keyFile};
}
export function createFcmSender({Auth=GoogleAuth,http=axios}={}) {
  let cached;
  return async row=>{
    const {project,keyFile,relayUrl,relaySecret}=pushConfiguration();
    if(relayUrl){
      await sendRelayPayload({relayUrl,relaySecret},{token:row.token,notificationId:row.notification_id,type:row.type,target:row.target},http);
      return;
    }
    if(!cached||cached.keyFile!==keyFile)cached={keyFile,auth:new Auth({keyFile,scopes:['https://www.googleapis.com/auth/firebase.messaging']})};
    let timeout;
    const token=await Promise.race([cached.auth.getAccessToken(),new Promise((_,reject)=>{
      timeout=setTimeout(()=>reject(Object.assign(new Error('FCM authorization timed out.'),{code:'FCM_AUTH_TIMEOUT'})),10000);
    })]).finally(()=>clearTimeout(timeout));
    if(!token)throw Object.assign(new Error('FCM authorization unavailable.'),{code:'FCM_AUTH'});
    // Lock-screen text never contains private business content.
    await http.post(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`,{
      message:{token:row.token,notification:{title:'Artictern',body:'Open Artictern to view your update.'},
        data:{notificationId:row.notification_id,type:row.type,targetType:row.target.type,targetId:row.target.id},
        android:{ttl:'86400s',notification:{tag:row.notification_id}},
        apns:{headers:{'apns-collapse-id':row.notification_id}},
      },
    },{headers:{Authorization:`Bearer ${token}`},timeout:5000,maxRedirects:0});
  };
}
export const sendNotificationPush=createFcmSender();

export function classifyPushFailure(error,attempt,now=Date.now()) {
  const status=error.response?.status;
  const unregistered=error.response?.data?.error?.details?.some(v=>
    v['@type']==='type.googleapis.com/google.firebase.fcm.v1.FcmError'&&v.errorCode==='UNREGISTERED');
  const terminal=Boolean(unregistered)||(status>=400&&status<500&&![401,403,408,429].includes(status));
  const code=unregistered?'UNREGISTERED':status?`FCM_HTTP_${Number(status)||0}`:
    ['FCM_CONFIGURATION','FCM_AUTH','FCM_AUTH_TIMEOUT'].includes(error.code)?error.code:'FCM_SEND_FAILED';
  const header=error.response?.headers?.['retry-after'];
  const retryAfter=typeof header==='string'&&/^\d+$/.test(header)?Number(header):
    header?Math.max(0,Math.ceil((Date.parse(header)-now)/1000)):0;
  const backoff=60*2**Math.min(attempt-1,5)+Math.floor(Math.random()*30);
  return {code,unregistered:Boolean(unregistered),terminal:terminal||attempt>=5,
    retrySeconds:Math.max(backoff,Number.isFinite(retryAfter)?retryAfter:0,status===429?60:0)};
}
