import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {GoogleAuth} from 'google-auth-library';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=status=>Object.assign(new Error('Relay request failed.'),{status});
export function createRelay({secret,project,auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/firebase.messaging']}),http=fetch,now=Date.now}={}){
  if(typeof secret!=='string'||secret.length<64||!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project||''))throw fail(503);
  return createServer(async(req,res)=>{
    const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
    try{
      if(req.method!=='POST'||req.url!=='/send')throw fail(404);
      const timestamp=req.headers['x-relay-timestamp'],signature=req.headers['x-relay-signature'];
      if(typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(now()-Number(timestamp))>60000||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))throw fail(401);
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>8192)throw fail(413);chunks.push(chunk);}
      const body=Buffer.concat(chunks);
      const expected=createHmac('sha256',secret).update(`${timestamp}\nPOST\n/send\n`).update(body).digest();
      if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw fail(401);
      let input;try{input=JSON.parse(body.toString('utf8'));}catch{throw fail(400);}
      if(!input||typeof input.token!=='string'||input.token.length<20||input.token.length>4096)throw fail(400);
      const chat=input.kind==='CHAT';
      if(input.kind!==undefined&&!chat)throw fail(400);
      if(chat){
        if(!uuid.test(input.conversationId||'')||!uuid.test(input.messageId||'')||typeof input.eventId!=='string'||!/^\d{1,20}$/.test(input.eventId))throw fail(400);
      }else if(!uuid.test(input.notificationId||'')||typeof input.type!=='string'||!/^[A-Z_]{1,80}$/.test(input.type)||typeof input.target?.type!=='string'||!/^[A-Z_]{1,40}$/.test(input.target.type)||!uuid.test(input.target.id||''))throw fail(400);
      let timer;
      const token=await Promise.race([auth.getAccessToken(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail(503)),5000);})]).finally(()=>clearTimeout(timer));
      if(!token)throw fail(503);
      const response=await http(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
        headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
        body:JSON.stringify({message:chat?{token:input.token,
          notification:{title:'New message',body:'Open Artictern to view it.'},
          data:{conversationId:input.conversationId,messageId:input.messageId,eventId:input.eventId},
        }:{token:input.token,
          notification:{title:'Artictern',body:'Open Artictern to view your update.'},
          data:{notificationId:input.notificationId,type:input.type,targetType:input.target.type,targetId:input.target.id},
          android:{ttl:'86400s',notification:{tag:input.notificationId}},
          apns:{headers:{'apns-collapse-id':input.notificationId}},
        }}),
      });
      if(!response.ok){
        const data=await response.json().catch(()=>null);
        const unregistered=data?.error?.details?.some(v=>v['@type']==='type.googleapis.com/google.firebase.fcm.v1.FcmError'&&v.errorCode==='UNREGISTERED');
        const retry=response.headers.get('retry-after');
        if(retry&&/^\d{1,6}$/.test(retry))res.setHeader('retry-after',retry);
        // Only this typed result may invalidate a device. Never forward provider messages.
        if(unregistered)return reply(404,{error:{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]}});
        return reply([400,413].includes(response.status)?400:503,{code:'FCM_SEND_FAILED'});
      }
      reply(200,{success:true});
    }catch(error){reply(error.status||503,{code:'RELAY_REQUEST_FAILED'});}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const server=createRelay({secret:process.env.NOTIFICATION_RELAY_SECRET,project:process.env.NOTIFICATION_FCM_PROJECT_ID});
  server.requestTimeout=10000;server.headersTimeout=10000;
  server.listen(Number(process.env.PORT)||8080,'0.0.0.0');
  process.on('SIGTERM',()=>server.close());
}
