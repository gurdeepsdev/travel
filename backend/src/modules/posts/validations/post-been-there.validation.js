import { z } from "zod";


const DEFAULT_BEEN_THERE_LIMIT = 20;
const MAX_BEEN_THERE_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;


const beenThereCursorSchema = z
  .string()
  .trim()
  .min(
    1,
    "Cursor cannot be empty.",
  )
  .max(
    MAX_CURSOR_LENGTH,
    `Cursor cannot exceed ${MAX_CURSOR_LENGTH} characters.`,
  )
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Cursor must be a valid Base64 URL-safe value.",
  );

const postIdParamsSchema = z
  .object({
    postId: z
      .string()
      .trim()
      .uuid("Post ID must be a valid UUID."),
  })
  .strict();

const setPostBeenThereSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({})
    .strict(),

  query: z
    .object({})
    .strict(),
});

const removePostBeenThereSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({})
    .strict()
    .optional(),

  query: z
    .object({})
    .strict(),
});

const getPostBeenThereSchema = z.object({
  params: z
    .object({
      postId: z
        .string()
        .trim()
        .uuid(
          "Post ID must be a valid UUID.",
        ),
    })
    .strict(),

  body: z
    .unknown()
    .optional(),

  query: z
    .object({
      limit: z.coerce
        .number({
          error:
            "Limit must be a number.",
        })
        .int(
          "Limit must be an integer.",
        )
        .min(
          1,
          "Limit must be at least 1.",
        )
        .max(
          MAX_BEEN_THERE_LIMIT,
          `Limit cannot exceed ${MAX_BEEN_THERE_LIMIT}.`,
        )
        .default(
          DEFAULT_BEEN_THERE_LIMIT,
        ),

      cursor:
        beenThereCursorSchema.optional(),
    })
    .strict(),
});
export {
  DEFAULT_BEEN_THERE_LIMIT,
  MAX_BEEN_THERE_LIMIT,
  setPostBeenThereSchema,
  removePostBeenThereSchema,
    getPostBeenThereSchema,

};