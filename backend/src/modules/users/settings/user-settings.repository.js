import Database from '../../../database/database-manager.js';
import AppError from '../../../core/errors/app-error.js';

export const namespace='appSettingsV1';
class UserSettingsRepository {
  async get(userId){
    const {rows}=await Database.query('SELECT settings_json->$2 AS settings FROM users.user_settings WHERE user_id=$1',[userId,namespace]);
    return rows[0]?.settings??{};
  }
  async patch(userId,settings){
    return Database.transaction(async client=>{
      await client.query('INSERT INTO users.user_settings(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING',[userId]);
      const {rows}=await client.query('SELECT settings_json->$2 AS settings FROM users.user_settings WHERE user_id=$1 FOR UPDATE',[userId,namespace]);
      const current=rows[0]?.settings??{};
      const merged={...current,...Object.fromEntries(settings.map(({key,type,value})=>[key,{type,value}]))};
      if(Object.keys(merged).length>100)throw new AppError({code:'SETTINGS.LIMIT_EXCEEDED',message:'A maximum of 100 settings is allowed.',statusCode:400});
      const result=await client.query(`UPDATE users.user_settings
        SET settings_json=jsonb_set(settings_json,ARRAY[$2]::text[],$3::jsonb,true),updated_at=CURRENT_TIMESTAMP
        WHERE user_id=$1 RETURNING settings_json->$2 AS settings`,[userId,namespace,JSON.stringify(merged)]);
      return result.rows[0].settings;
    });
  }
}
export default new UserSettingsRepository();
