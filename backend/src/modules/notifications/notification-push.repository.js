import { pushEnabled } from './notification-fcm.service.js';

export async function enqueueNotificationPush(client,notification) {
  // Chat has its own established FCM path; do not send duplicate chat pushes.
  if(!pushEnabled()||!notification.push||notification.category==='CHAT')return;
  await client.query(`INSERT INTO notification.push_outbox(notification_id,device_id,session_id)
    SELECT $1,d.id,d.session_id FROM chat.push_devices d
    JOIN auth.sessions s ON s.id=d.session_id AND s.user_id=d.user_id AND s.expires_at>CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    WHERE d.user_id=$2 AND d.enabled ON CONFLICT(notification_id,device_id) DO NOTHING`,[notification.id,notification.user_id]);
}

export async function claimNotificationPush(client) {
  const {rows}=await client.query(`UPDATE notification.push_outbox p SET lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+INTERVAL '120 seconds',attempts=p.attempts+1
    FROM (SELECT id FROM notification.push_outbox WHERE completed_at IS NULL
      AND next_attempt_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp())
      ORDER BY id LIMIT 5 FOR UPDATE SKIP LOCKED) due WHERE p.id=due.id RETURNING p.*`);
  return rows;
}

export async function eligibleNotificationPush(client,row) {
  const {rows}=await client.query(`SELECT n.id AS notification_id,n.type,n.target,d.token,d.token_hash,d.id AS device_id
    FROM notification.push_outbox q JOIN notification.notifications n ON n.id=q.notification_id
    JOIN auth.users u ON u.id=n.user_id AND u.status='ACTIVE'
    JOIN chat.push_devices d ON d.id=q.device_id AND d.user_id=n.user_id AND d.enabled
    JOIN auth.sessions s ON s.id=q.session_id AND s.id=d.session_id AND s.user_id=n.user_id
      AND s.expires_at>CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
    LEFT JOIN notification.preferences pref ON pref.user_id=n.user_id AND pref.category=n.category
    WHERE q.id=$1 AND q.lease_token=$2 AND q.completed_at IS NULL AND q.lease_until>clock_timestamp()
    AND q.expires_at>clock_timestamp() AND n.push AND n.category<>'CHAT' AND n.read_at IS NULL
    AND COALESCE(pref.push,true)
    AND NOT EXISTS(SELECT 1 FROM users.blocked_users b WHERE
      (b.user_id=n.user_id AND b.blocked_user_id=n.actor_id) OR (b.user_id=n.actor_id AND b.blocked_user_id=n.user_id))`,[row.id,row.lease_token]);
  return rows[0];
}
