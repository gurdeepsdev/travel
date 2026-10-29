import Database from '../database/database-manager.js';
import logger from '../core/logger/logger.js';
import { emitUserEvent } from './realtime-server.js';
import { mapNotification } from '../modules/notifications/notification.repository.js';
let timer,busy=false;

export async function processNotificationOutbox(emit=emitUserEvent) {
  if(busy)return;
  busy=true;
  try {
    await Database.transaction(async client=>{
      const {rows}=await client.query(`SELECT o.*,u.status FROM notification.event_outbox o
        JOIN auth.users u ON u.id=o.user_id WHERE o.completed_at IS NULL AND o.next_attempt_at<=clock_timestamp()
        ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED`);
      for(const row of rows) {
        try {
          if(row.status==='ACTIVE') {
            const payload={eventId:String(row.id),...row.payload};
            if(row.event_type==='notification.created') {
              const {rows:[notification]}=await client.query('SELECT * FROM notification.notifications WHERE id=$1 AND user_id=$2 AND in_app',[row.notification_id,row.user_id]);
              if(notification)await emit(row.user_id,row.event_type,{...payload,notification:mapNotification(notification)});
            } else await emit(row.user_id,row.event_type,payload);
          }
          await client.query('UPDATE notification.event_outbox SET completed_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1',[row.id]);
        } catch(error) {
          // Leave the event pending; retry transport failures with bounded exponential backoff.
          await client.query(`UPDATE notification.event_outbox SET attempts=attempts+1,
            next_attempt_at=clock_timestamp()+($2::int*INTERVAL '1 second') WHERE id=$1`,[row.id,Math.min(300,2**Math.min(row.attempts+1,8))]);
          logger.warn({eventId:String(row.id)},'Notification realtime delivery deferred.');
        }
      }
      await client.query(`DELETE FROM notification.event_outbox WHERE id IN
        (SELECT id FROM notification.event_outbox WHERE completed_at<clock_timestamp()-INTERVAL '7 days' LIMIT 500)`);
    });
  } catch(error) {
    logger.error({code:error.code??'NOTIFICATION_OUTBOX_FAILED'},'Notification outbox processing failed.');
  } finally {busy=false;}
}
export function startNotificationOutboxWorker(){if(!timer){timer=setInterval(()=>void processNotificationOutbox(),1000);timer.unref();}}
export function stopNotificationOutboxWorker(){clearInterval(timer);timer=undefined;}
