import {Router} from 'express';
import Auth from '../../../middleware/auth.middleware.js';
import validate from '../../../middleware/validate.middleware.js';
import Response from '../../../core/response/index.js';
import repository from './visited-city.repository.js';
import {getSchema,metadataSchema,addSchema,updateSchema,deleteSchema,completeSchema} from './visited-city.validation.js';

const router=Router();
const base='/me/visited-cities/:cityId/itinerary-draft';
function handle(action){return async(req,res,next)=>{try{
  const result=await repository.execute({userId:req.user.id,...req.validated.params,action,input:req.validated.body??{}});
  res.set('Cache-Control','private, no-store');
  return Response.success(res,result,action==='complete'?'Visited itinerary completed successfully.':'Visited itinerary draft fetched or updated successfully.');
}catch(error){next(error);}};}
for(const [method,path,schema,action] of [
  ['get',base,getSchema,'get'],['patch',base,metadataSchema,'metadata'],
  ['post',base+'/attractions',addSchema,'add'],['patch',base+'/attractions/:attractionId',updateSchema,'update'],
  ['delete',base+'/attractions/:attractionId',deleteSchema,'delete'],['post',base+'/complete',completeSchema,'complete'],
])router[method](path,Auth.authenticate,validate(schema),handle(action));
export default router;
