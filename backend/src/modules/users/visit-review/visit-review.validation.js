import {z} from 'zod';
const params=z.object({targetType:z.enum(['CITY','PLACE']),verificationId:z.string().uuid()}).strict();
export const listSchema=z.object({params:z.object({}).strict(),body:z.object({}).strict().optional(),query:z.object({
  status:z.enum(['PENDING','VERIFIED','REJECTED']).default('PENDING'),
  limit:z.coerce.number().int().min(1).max(50).default(20),
  cursor:z.string().max(1000).optional().transform((value,ctx)=>{
    if(!value)return null;
    try{const parsed=JSON.parse(Buffer.from(value,'base64url').toString());return z.object({createdAt:z.iso.datetime({offset:true}),id:z.string().uuid(),targetType:z.enum(['CITY','PLACE'])}).strict().parse(parsed);}
    catch{ctx.addIssue({code:'custom',message:'Invalid review cursor.'});return z.NEVER;}
  }),
}).strict()});
export const detailSchema=z.object({params,body:z.object({}).strict().optional(),query:z.object({}).strict()});
export const reviewSchema=z.object({params,query:z.object({}).strict(),body:z.object({
  decision:z.enum(['VERIFIED','REJECTED']),evidenceAssetId:z.string().uuid(),
  reason:z.string().trim().min(1).max(1000).optional(),iconAssetId:z.string().uuid().optional(),
}).strict().superRefine((v,ctx)=>{
  if(v.decision==='REJECTED'&&!v.reason)ctx.addIssue({code:'custom',message:'Rejection reason is required.',path:['reason']});
  if(v.decision==='REJECTED'&&v.iconAssetId)ctx.addIssue({code:'custom',message:'An icon is only accepted when approving.',path:['iconAssetId']});
})});
