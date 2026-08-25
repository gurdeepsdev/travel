import { z } from "zod";

const MAX_REPOST_MESSAGE_LENGTH = 250;

const postIdParamsSchema = z
  .object({
    postId: z
      .string()
      .trim()
      .uuid(
        "Post ID must be a valid UUID.",
      ),
  })
  .strict();

const setPostRepostSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({
      message: z
        .string({
          error:
            "Repost message must be a string.",
        })
        .trim()
        .min(
          1,
          "Repost message cannot be empty.",
        )
        .max(
          MAX_REPOST_MESSAGE_LENGTH,
          `Repost message cannot exceed ${MAX_REPOST_MESSAGE_LENGTH} characters.`,
        )
        .optional(),
    })
    .strict(),

  query: z.object({}).strict(),
});

const removePostRepostSchema = z.object({
  params: postIdParamsSchema,
  body: z.object({}).strict().optional(),
  query: z.object({}).strict(),
});

export {
  MAX_REPOST_MESSAGE_LENGTH,
  removePostRepostSchema,
  setPostRepostSchema,
};
