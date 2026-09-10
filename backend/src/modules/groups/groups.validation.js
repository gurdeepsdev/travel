import { z } from "zod";

export const getGroupSchema = z.object({
  body: z.object({}).strict().optional(),
  params: z.object({ groupId: z.string().trim().uuid() }).strict(),
  query: z.object({}).strict(),
});

export const getItineraryGroupSchema = getGroupSchema.extend({
  params: z.object({ itineraryId: z.string().trim().uuid() }).strict(),
});

export const listMyGroupsSchema = z.object({
  body: z.object({}).strict().optional(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(1000).optional(),
  }).strict(),
});

export const createStandaloneGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(2000).optional(),
  }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const linkGroupItinerarySchema = z.object({
  body: z.object({ itineraryId: z.string().trim().uuid() }).strict(),
  params: z.object({ groupId: z.string().trim().uuid() }).strict(),
  query: z.object({}).strict(),
});

const createLinkedGroupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
  }).strict(),
  params: z.object({
    itineraryId: z.string().trim().uuid(
      "Itinerary ID must be a valid UUID.",
    ),
  }),
  query: z.object({}).strict(),
});

const listLinkedGroupMembersSchema = z.object({
  body: z.object({}).strict().optional(),
  params: createLinkedGroupSchema.shape.params,
  query: z.object({}).strict(),
});

const createGroupInvitationSchema = z.object({
  body: z.object({
    userId: z.string().trim().uuid("User ID must be a valid UUID."),
    message: z.string().trim().min(1).max(500).optional(),
  }).strict(),
  params: createLinkedGroupSchema.shape.params,
  query: z.object({}).strict(),
});

export {
  removeGroupMemberSchema,
  leaveGroupSchema,
  listGroupInvitationsSchema,
  respondToGroupInvitationSchema,
  createGroupInvitationSchema,
  createLinkedGroupSchema,
  listLinkedGroupMembersSchema,
};

const removeGroupMemberSchema = z.object({
  body: z.object({}).strict().optional(),
  params: createLinkedGroupSchema.shape.params.extend({ userId: z.string().trim().uuid() }),
  query: z.object({}).strict(),
});

const leaveGroupSchema = listLinkedGroupMembersSchema;

const listGroupInvitationsSchema = z.object({
  body: z.object({}).strict().optional(),
  params: z.object({}).strict(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(1000).optional(),
    status: z.enum(['PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED']).optional(),
  }).strict(),
});

const respondToGroupInvitationSchema = z.object({
  body: z.object({ status: z.enum(['ACCEPTED','DECLINED']) }).strict(),
  params: z.object({ invitationId: z.string().trim().uuid() }),
  query: z.object({}).strict(),
});
