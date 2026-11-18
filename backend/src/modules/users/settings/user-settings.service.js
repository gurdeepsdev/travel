import env from '../../../config/env.js';
import AppError from '../../../core/errors/app-error.js';
import repository from './user-settings.repository.js';
import {approvedSettings,settingSchema} from './user-settings.validation.js';

const dynamicAllowed=()=>env.NODE_ENV==='uat';
const approved=setting=>Object.hasOwn(approvedSettings,setting.key)&&approvedSettings[setting.key].safeParse(setting).success;
const map=settings=>({settings:Object.entries(settings).flatMap(([key,entry])=>{
  const parsed=settingSchema.safeParse({key,...entry});
  return parsed.success&&(dynamicAllowed()||approved(parsed.data))?[parsed.data]:[];
}).sort((a,b)=>a.key.localeCompare(b.key))});
class UserSettingsService {
  async get(userId){return map(await repository.get(userId));}
  async patch(userId,settings){
    if(!dynamicAllowed()&&settings.some(setting=>!approved(setting)))throw new AppError({
      code:'SETTINGS.KEY_NOT_APPROVED',message:'Setting key or value is not approved for this environment.',statusCode:400,
    });
    return map(await repository.patch(userId,settings));
  }
}
export default new UserSettingsService();
