import {z} from 'zod';

const key=z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
  .refine(value=>!['__proto__','prototype','constructor'].includes(value),'Reserved setting key.');
export const settingSchema=z.discriminatedUnion('type',[
  z.object({key,type:z.literal('string'),value:z.string().max(2048)}).strict(),
  z.object({key,type:z.literal('boolean'),value:z.boolean()}).strict(),
  z.object({key,type:z.literal('number'),value:z.number().finite()}).strict(),
]);
export const patchSettingsSchema=z.object({
  params:z.object({}).strict(),query:z.object({}).strict(),
  body:z.object({settings:z.array(settingSchema).min(1).max(50)
    .refine(values=>new Set(values.map(v=>v.key)).size===values.length,'Duplicate setting keys.')}).strict(),
});
export const getSettingsSchema=z.object({params:z.object({}).strict(),query:z.object({}).strict(),body:z.object({}).strict().optional()});

// Production keys must be explicitly reviewed and added here before use.
export const approvedSettings=Object.freeze({});
