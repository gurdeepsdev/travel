import Database from '../../database/database-manager.js';
import AppError from '../../core/errors/app-error.js';
import { decodeCursor, encodeCursor } from '../../shared/utils/cursor.js';
import { categories, notificationTypes } from './notification.types.js';
import { notificationInput } from './notification.validation.js';

export const mapNotification = row => ({ id: row.id, type: row.type, category: row.category,
  priority: row.priority, actorId: row.actor_id, title: row.title, body: row.body, target: row.target,
  readAt: row.read_at, createdAt: row.created_at });
const one = async (client, sql, args) => (await client.query(sql,args)).rows[0];
const journal = (client,userId,type,id=null,payload={}) => client.query(`INSERT INTO notification.event_outbox
  (user_id,notification_id,event_type,payload) VALUES($1,$2,$3,$4::jsonb)`,[userId,id,type,JSON.stringify(payload)]);

export class NotificationRepository {
  async createInTransaction(client, input) {
    const value = notificationInput.parse(input), rule = notificationTypes[value.type];
    if (rule.enabled === false) throw new AppError({ code:'NOTIFICATION.TYPE_UNAVAILABLE',statusCode:409,message:'Notification type is not enabled.' });
    if (value.actorId === value.userId) return { notification:null,created:false };
    const user = await one(client,"SELECT id FROM auth.users WHERE id=$1 AND status='ACTIVE' FOR SHARE",[value.userId]);
    if (!user) return { notification:null,created:false };
    const preferences = await one(client,'SELECT in_app,push FROM notification.preferences WHERE user_id=$1 AND category=$2',[value.userId,rule.category]);
    const inApp = rule.channels.includes('IN_APP') && (preferences?.in_app ?? true);
    const push = rule.channels.includes('PUSH') && (preferences?.push ?? true);
    // Store the identity even when opted out so retries cannot resurrect the same event.
    const row = await one(client,`INSERT INTO notification.notifications
      (user_id,actor_id,event_key,type,category,priority,title,body,target,in_app,push)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
      ON CONFLICT(user_id,event_key) DO NOTHING RETURNING *`,[value.userId,value.actorId??null,value.eventKey,
      value.type,rule.category,rule.priority,value.title,value.body,JSON.stringify(value.target),inApp,push]);
    if (!row) return { notification:null,created:false };
    if (inApp) await journal(client,value.userId,'notification.created',row.id);
    return { notification:inApp?mapNotification(row):null,created:true };
  }
  async list(userId,{limit,cursor,unreadOnly=false}) {
    const position=decodeCursor(cursor);
    const {rows}=await Database.query(`SELECT *,created_at::text AS cursor_time FROM notification.notifications
      WHERE user_id=$1 AND in_app AND (NOT $2::boolean OR read_at IS NULL)
      AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid))
      ORDER BY created_at DESC,id DESC LIMIT $5`,[userId,unreadOnly,position?.createdAt??null,position?.id??null,limit+1]);
    const page=rows.slice(0,limit),last=page.at(-1),hasMore=rows.length>limit;
    return { notifications:page.map(mapNotification),pagination:{hasMore,nextCursor:hasMore?encodeCursor({createdAt:last.cursor_time,id:last.id}):null} };
  }
  async unread(userId) {
    const row=await one(Database,'SELECT COUNT(*)::int AS count FROM notification.notifications WHERE user_id=$1 AND in_app AND read_at IS NULL',[userId]);
    return {unreadCount:row.count};
  }
  async read(userId,id) {
    return Database.transaction(async client=>{
      const row=await one(client,'SELECT * FROM notification.notifications WHERE id=$1 AND user_id=$2 AND in_app FOR UPDATE',[id,userId]);
      if(!row)throw new AppError({code:'NOTIFICATION.NOT_FOUND',statusCode:404,message:'Notification is unavailable.'});
      if(row.read_at)return {notification:mapNotification(row),updated:false};
      const updated=await one(client,'UPDATE notification.notifications SET read_at=clock_timestamp() WHERE id=$1 RETURNING *',[id]);
      await journal(client,userId,'notification.read',id,{all:false,notificationId:id,readAt:updated.read_at});
      return {notification:mapNotification(updated),updated:true};
    });
  }
  async readAll(userId) {
    return Database.transaction(async client=>{
      const {rowCount}=await client.query('UPDATE notification.notifications SET read_at=statement_timestamp() WHERE user_id=$1 AND in_app AND read_at IS NULL',[userId]);
      if(rowCount)await journal(client,userId,'notification.read',null,{all:true,updatedCount:rowCount});
      return {updatedCount:rowCount};
    });
  }
  async preferences(userId) {
    const {rows}=await Database.query('SELECT category,in_app,push FROM notification.preferences WHERE user_id=$1',[userId]);
    return {preferences:categories.map(category=>{const row=rows.find(v=>v.category===category);return {category,inApp:row?.in_app??true,push:row?.push??true};})};
  }
  async updatePreferences(userId,preferences) {
    await Database.transaction(async client=>{
      for(const preference of [...preferences].sort((a,b)=>a.category.localeCompare(b.category)))await client.query(`INSERT INTO notification.preferences(user_id,category,in_app,push)
        VALUES($1,$2,COALESCE($3,true),COALESCE($4,true)) ON CONFLICT(user_id,category) DO UPDATE SET
        in_app=COALESCE($3,notification.preferences.in_app),push=COALESCE($4,notification.preferences.push),updated_at=clock_timestamp()`,
      [userId,preference.category,preference.inApp??null,preference.push??null]);
    });
    return this.preferences(userId);
  }
}
export default new NotificationRepository();
