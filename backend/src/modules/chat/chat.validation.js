import { z } from "zod";

const id = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
export const createConversationSchema = z.object({
  params: z.object({}).strict(),
  query: z.object({}).strict(),
  body: z.discriminatedUnion("type", [
    z.object({ type: z.literal("direct"), userId: id }).strict(),
    z.object({ type: z.literal("group"), groupId: id }).strict(),
    z.object({ type: z.literal("community"), communityId: id }).strict(),
  ]),
});
export const getConversationSchema = z.object({
  params: z.object({ conversationId: id }).strict(),
  query: z.object({}).strict(),
  body: z.object({}).strict().optional(),
});
export const respondConversationSchema = getConversationSchema.extend({
  body: z.object({ status: z.enum(["ACCEPTED", "REJECTED"]) }).strict(),
});
export const sendMessageSchema = getConversationSchema.extend({
  body: z
    .object({
      text: z.string().trim().min(1).max(512).optional(),
      clientMessageId: id,
      replyToMessageId: id.optional(),
      itineraryId: id.optional(),
      assetIds: z
        .array(id)
        .min(1)
        .max(10)
        .refine((ids) => new Set(ids).size === ids.length)
        .optional(),
    })
    .strict()
    .refine(
      (body) => Boolean(body.text || body.itineraryId || body.assetIds),
      "Message content is required.",
    )
    .refine(
      (body) => !(body.itineraryId && body.assetIds),
      "Share either an itinerary or attachments.",
    ),
});
export const messageHistorySchema = getConversationSchema.extend({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      cursor: z.string().max(1000).optional(),
    })
    .strict(),
});
export const requestMessageSchema = getConversationSchema.extend({
  body: z
    .object({ text: z.string().trim().min(1).max(512), clientMessageId: id })
    .strict(),
});
export const replaySchema = createConversationSchema.extend({
  body: z.object({}).strict().optional(),
  query: z
    .object({
      after: z
        .string()
        .regex(/^(0|[1-9][0-9]{0,18})$/)
        .refine((value) => BigInt(value) <= 9223372036854775807n)
        .optional(),
      limit: z.coerce.number().int().min(1).max(100).default(100),
    })
    .strict(),
});
export const editMessageSchema = getConversationSchema.extend({
  params: z.object({ conversationId: id, messageId: id }).strict(),
  body: z.object({ text: z.string().trim().min(1).max(512) }).strict(),
});
export const deleteMessageSchema = editMessageSchema.extend({
  body: z.object({}).strict().optional(),
  query: z.object({ scope: z.enum(["me", "everyone"]).default("me") }).strict(),
});
export const reactionSchema = editMessageSchema.extend({
  body: z
    .object({ reaction: z.enum(["👍", "❤️", "😂", "😮", "😢", "🙏"]) })
    .strict(),
});
export const receiptSchema = editMessageSchema.extend({
  body: z.object({ status: z.enum(["DELIVERED", "READ"]) }).strict(),
});
export const messageResourceSchema = editMessageSchema.extend({
  body: z.object({}).strict().optional(),
});
export const attachmentResourceSchema = messageResourceSchema.extend({
  params: z.object({ conversationId: id, messageId: id, assetId: id }).strict(),
});
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
export const pushDeviceSchema = createConversationSchema.extend({
  body: z
    .object({
      deviceId: id,
      platform: z.enum(["android", "ios"]),
      token: z.string().trim().min(20).max(4096),
    })
    .strict(),
});
export const deletePushDeviceSchema = createConversationSchema.extend({
  body: z.object({}).strict().optional(),
  params: z.object({ deviceId: id }).strict(),
});
export const unreadSchema = createConversationSchema.extend({
  body: z.object({}).strict().optional(),
});
export const inboxSchema = createConversationSchema.extend({
  body: z.object({}).strict().optional(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      cursor: z.string().max(1000).optional(),
      archived: booleanQuery.default(false),
      requests: booleanQuery.optional(),
    })
    .strict(),
});
export const settingsSchema = getConversationSchema.extend({
  body: z
    .object({ muted: z.boolean().optional(), archived: z.boolean().optional() })
    .strict()
    .refine((body) => Object.keys(body).length > 0),
});
export const readConversationSchema = getConversationSchema.extend({
  body: z.object({ messageId: id }).strict(),
});
export const reportMessageSchema = messageResourceSchema.extend({
  body: z
    .object({
      reasonCode: z.enum([
        "SPAM",
        "HARASSMENT",
        "HATE_SPEECH",
        "SEXUAL_CONTENT",
        "VIOLENCE",
        "SCAM",
        "OTHER",
      ]),
      description: z.string().trim().min(1).max(2000).optional(),
    })
    .strict(),
});
