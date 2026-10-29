import { z } from 'zod';
import { categories, notificationTypes } from './notification.types.js';
const empty = z.object({}).strict();
export const base = z.object({ params: empty, query: empty, body: empty.optional() });
export const listing = base.extend({ query: z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(1000).optional(),
  unreadOnly: z.enum(['true','false']).transform(v => v === 'true').default(false),
}).strict() });
export const resource = base.extend({ params: z.object({ notificationId: z.string().uuid() }).strict() });
export const preferenceUpdate = base.extend({ body: z.object({ preferences: z.array(z.object({
  category: z.enum(categories), inApp: z.boolean().optional(), push: z.boolean().optional(),
}).strict().refine(v => v.inApp !== undefined || v.push !== undefined, 'Provide inApp or push.'))
  .min(1).max(categories.length).refine(rows => new Set(rows.map(v => v.category)).size === rows.length, 'Duplicate categories are not allowed.') }).strict() });

// Internal producer contract only; no public create-notification endpoint.
export const notificationInput = z.object({
  userId: z.string().uuid(), actorId: z.string().uuid().nullable().optional(),
  eventKey: z.string().trim().min(1).max(200), type: z.enum(Object.keys(notificationTypes)),
  title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(500),
  target: z.object({ type: z.enum(['USER','POST','COMMENT','CONVERSATION','GROUP','ITINERARY','EXPENSE','PLACE','DOCUMENT','SUPPORT']),
    id: z.string().uuid() }).strict(),
}).strict();
