import Database from '../database/database-manager.js';
import logger from '../core/logger/logger.js';
import { pushEnabled,pushConfiguration,sendNotificationPush,classifyPushFailure } from '../modules/notifications/notification-fcm.service.js';
import { claimNotificationPush,eligibleNotificationPush } from '../modules/notifications/notification-push.repository.js';
let timer,busy=false;
const complete=(client,row,code)=>client.query(`UPDATE notification.push_outbox SET completed_at=clock_timestamp(),
  failure_code=$3,lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2`,[row.id,row.lease_token,code]);

export async function processNotificationPush(send=sendNotificationPush) {
  if(busy||!pushEnabled())return;
  busy=true;
  try {
    // Configuration failures must not burn retries or lease pending messages.
    pushConfiguration();
    const rows=await Database.transaction(claimNotificationPush);
    for(const row of rows) {
      if(row.attempts>5){await complete(Database,row,'ATTEMPTS_EXHAUSTED');continue;}
      const recipient=await eligibleNotificationPush(Database,row);
      if(!recipient){await complete(Database,row,'SUPPRESSED');continue;}
      try {
        await send(recipient);
        await complete(Database,row,null);
      } catch(error) {
        const failure=classifyPushFailure(error,row.attempts);
        await Database.transaction(async client=>{
          // A token may have rotated while FCM was processing the old one.
          if(failure.unregistered)await client.query('UPDATE chat.push_devices SET enabled=false WHERE id=$1 AND token_hash=$2',[recipient.device_id,recipient.token_hash]);
          if(failure.terminal)await complete(client,row,failure.code);
          else await client.query(`UPDATE notification.push_outbox SET failure_code=$3,next_attempt_at=clock_timestamp()+($4::double precision*INTERVAL '1 second'),
            lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2`,[row.id,row.lease_token,failure.code,failure.retrySeconds]);
        });
        logger.warn({code:failure.code},'Notification push delivery failed.');
      }
    }
    await Database.query(`DELETE FROM notification.push_outbox WHERE id IN
      (SELECT id FROM notification.push_outbox WHERE completed_at<clock_timestamp()-INTERVAL '7 days' LIMIT 500)`);
  } catch(error) {
    logger.error({code:['FCM_CONFIGURATION'].includes(error.code)?error.code:'NOTIFICATION_PUSH_FAILED'},'Notification push processing failed.');
  } finally {busy=false;}
}
export function startNotificationPushWorker(){
  if(timer||!pushEnabled())return;
  try{pushConfiguration();}catch{logger.error({code:'FCM_CONFIGURATION'},'Notification push worker not started.');return;}
  timer=setInterval(()=>void processNotificationPush(),2000);timer.unref();
}
export function stopNotificationPushWorker(){clearInterval(timer);timer=undefined;}
