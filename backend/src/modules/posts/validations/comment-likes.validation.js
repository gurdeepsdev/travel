import { z } from "zod";

const commentIdParamsSchema = z
  .object({
    commentId: z
      .string()
      .trim()
      .uuid(
        "Comment ID must be a valid UUID.",
      ),
  })
  .strict();

const setCommentLikeSchema = z.object({
  params: commentIdParamsSchema,

  body: z
    .object({})
    .strict(),

  query: z
    .object({})
    .strict(),
});

const removeCommentLikeSchema = z.object({
  params: commentIdParamsSchema,

  body: z
    .object({})
    .strict()
    .optional(),

  query: z
    .object({})
    .strict(),
});

export {
  setCommentLikeSchema,
  removeCommentLikeSchema,
};
