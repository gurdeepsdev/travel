import { z } from "zod";

const getPostEngagementBatchSchema = z.object({
  params: z.object({}).strict(),
  query: z.object({}).strict(),
  body: z
    .object({
      postIds: z
        .array(
          z.string().uuid("Each post ID must be a valid UUID."),
        )
        .min(1, "At least one post ID is required.")
        .max(50, "A maximum of 50 post IDs is allowed."),
    })
    .strict(),
});

export { getPostEngagementBatchSchema };
