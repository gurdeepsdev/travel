import { z } from "zod";

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

const savePostSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({})
    .strict(),

  query: z
    .object({})
    .strict(),
});

const removeSavedPostSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({})
    .strict()
    .optional(),

  query: z
    .object({})
    .strict(),
});

export {
  savePostSchema,
  removeSavedPostSchema,
};