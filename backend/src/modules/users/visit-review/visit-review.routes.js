import {Router} from 'express';
import {z} from 'zod';
import Auth from '../../../middleware/auth.middleware.js';
import validate from '../../../middleware/validate.middleware.js';
import Response from '../../../core/response/index.js';
import AppError from '../../../core/errors/app-error.js';
import repository from './visit-review.repository.js';
import {listSchema,detailSchema,reviewSchema} from './visit-review.validation.js';
import MediaService from '../../media/media.service.js';

export function requireVisitReviewer(req,_res,next){
  const ids=(process.env.VISIT_REVIEW_ADMIN_USER_IDS??'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!ids.length||ids.some(id=>!z.string().uuid().safeParse(id).success)||!ids.includes(req.user.id))return next(new AppError({code:'VISIT_REVIEW.FORBIDDEN',message:'Visit review administrator access is required.',statusCode:403}));
  next();
}
const missing=()=>new AppError({code:'VISIT_REVIEW.NOT_FOUND',message:'Visit submission not found.',statusCode:404});
function map(row){return {id:row.id,targetType:row.target_type,user:{id:row.user_id,username:row.username,displayName:row.display_name},
  status:row.status,location:{id:row.place_id??row.city_id,name:row.place_name??row.city_name,cityId:row.city_id,cityName:row.city_name},
  evidence:{assetId:row.verification_asset_id,mimeType:row.mime_type,url:`/api/v1/admin/visit-verifications/${row.target_type}/${row.id}/evidence`},
  review:row.details?.review??null,createdAt:row.created_at,updatedAt:row.updated_at};}
const router=Router();router.use(Auth.authenticate,requireVisitReviewer,(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/',validate(listSchema),async(req,res,next)=>{try{
  const {limit,...query}=req.validated.query;const rows=await repository.list({...query,limit});const items=rows.slice(0,limit);const last=items.at(-1);const hasMore=rows.length>limit;
  return Response.success(res,{verifications:items.map(map),pagination:{hasMore,nextCursor:hasMore?Buffer.from(JSON.stringify({createdAt:last.cursor_created_at,id:last.id,targetType:last.target_type})).toString('base64url'):null}},'Visit review submissions fetched successfully.');
}catch(error){next(error);}});
router.get('/:targetType/:verificationId',validate(detailSchema),async(req,res,next)=>{try{
  const {targetType,verificationId}=req.validated.params;const row=await repository.detail(targetType,verificationId);if(!row)throw missing();
  return Response.success(res,{verification:map(row)},'Visit review submission fetched successfully.');
}catch(error){next(error);}});
router.get('/:targetType/:verificationId/evidence',validate(detailSchema),async(req,res,next)=>{try{
  const {targetType,verificationId}=req.validated.params;const row=await repository.detail(targetType,verificationId);if(!row||row.asset_deleted_at)throw missing();
  const result=await MediaService.getLocalAssetContent({assetId:row.verification_asset_id,viewerUserId:row.user_id});
  res.set({'Cache-Control':'private, no-store','Content-Type':result.asset.mime_type,'Content-Disposition':'inline','X-Content-Type-Options':'nosniff'});
  return res.sendFile(result.filePath,error=>{if(error)next(error);});
}catch(error){next(error);}});
router.post('/:targetType/:verificationId/review',validate(reviewSchema),async(req,res,next)=>{try{
  const {targetType,verificationId}=req.validated.params;
  const result=await repository.review({targetType,id:verificationId,reviewerId:req.user.id,input:req.validated.body});
  return Response.success(res,result,'Visit verification reviewed successfully.');
}catch(error){next(error);}});
export default router;
