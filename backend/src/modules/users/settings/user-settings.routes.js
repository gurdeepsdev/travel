import {Router} from 'express';
import AuthMiddleware from '../../../middleware/auth.middleware.js';
import validate from '../../../middleware/validate.middleware.js';
import Response from '../../../core/response/index.js';
import service from './user-settings.service.js';
import {getSettingsSchema,patchSettingsSchema} from './user-settings.validation.js';
const router=Router();
router.get('/me/settings',AuthMiddleware.authenticate,validate(getSettingsSchema),async(req,res,next)=>{
  try{return Response.success(res,await service.get(req.user.id),'User settings fetched successfully.');}catch(error){next(error);}
});
router.patch('/me/settings',AuthMiddleware.authenticate,validate(patchSettingsSchema),async(req,res,next)=>{
  try{return Response.success(res,await service.patch(req.user.id,req.validated.body.settings),'User settings updated successfully.');}catch(error){next(error);}
});
export default router;
