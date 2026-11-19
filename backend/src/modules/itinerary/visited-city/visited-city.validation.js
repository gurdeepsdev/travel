import {z} from 'zod';

const metadata = {
  title: z.string().trim().min(1).max(255),
  year: z.number().int().min(1900).max(9999),
  month: z.number().int().min(1).max(12),
  tripType: z.enum(['FAMILY','FRIENDS','SOLO','COUPLE','OTHER']),
};
const attractionFields = {
  placeId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).nullable(),
  address: z.string().trim().max(500).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
};
const params = z.object({cityId:z.string().uuid()});
const itemParams = params.extend({attractionId:z.string().uuid()});
const partial = fields => z.object(fields).partial().strict();
const nonempty = schema => schema.refine(v=>Object.keys(v).length>0,'At least one field is required.');
export const getSchema = z.object({params});
export const metadataSchema = z.object({params,body:nonempty(partial(metadata))});
export const addSchema = z.object({params,body:partial(attractionFields).refine(v=>v.placeId||v.name,'Provide placeId or name.')});
export const updateSchema = z.object({params:itemParams,body:nonempty(partial({...attractionFields,position:z.number().int().min(1).max(200)}))});
export const deleteSchema = z.object({params:itemParams});
export const completeSchema = z.object({params,body:partial(metadata).default({})});
