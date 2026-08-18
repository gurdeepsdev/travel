import { z } from "zod";


const DEFAULT_COMMENT_LIKES_LIMIT = 20;
const MAX_COMMENT_LIKES_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;

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


  const commentLikesCursorSchema = z
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


  const getCommentLikesSchema = z.object({
  params: commentIdParamsSchema,

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
          MAX_COMMENT_LIKES_LIMIT,
          `Limit cannot exceed ${MAX_COMMENT_LIKES_LIMIT}.`,
        )
        .default(
          DEFAULT_COMMENT_LIKES_LIMIT,
        ),

      cursor:
        commentLikesCursorSchema
          .optional(),
    })
    .strict(),
});

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
  DEFAULT_COMMENT_LIKES_LIMIT,
  MAX_COMMENT_LIKES_LIMIT,
  getCommentLikesSchema,
  setCommentLikeSchema,
  removeCommentLikeSchema,
};