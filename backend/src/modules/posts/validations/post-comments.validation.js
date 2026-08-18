import { z } from "zod";

const MAX_COMMENT_LENGTH = 250;

const DEFAULT_COMMENTS_LIMIT = 20;
const MAX_COMMENTS_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;

const commentCursorSchema = z
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

const getPostCommentsSchema = z.object({
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
          MAX_COMMENTS_LIMIT,
          `Limit cannot exceed ${MAX_COMMENTS_LIMIT}.`,
        )
        .default(
          DEFAULT_COMMENTS_LIMIT,
        ),

      cursor:
        commentCursorSchema.optional(),
    })
    .strict(),
});



const createPostCommentSchema = z.object({
  params: z
    .object({
      postId: z
        .string()
        .trim()
        .uuid("Post ID must be a valid UUID."),
    })
    .strict(),

  body: z
    .object({
      comment: z
        .string({
          error:
            "Comment must be a string.",
        })
        .trim()
        .min(
          1,
          "Comment cannot be empty.",
        )
        .max(
          MAX_COMMENT_LENGTH,
          `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`,
        ),

      parentCommentId: z
        .string()
        .trim()
        .uuid(
          "Parent comment ID must be a valid UUID.",
        )
        .optional(),
    })
    .strict(),

  query: z
    .object({})
    .strict(),
});

const deleteCommentSchema = z.object({
  params: z
    .object({
      commentId: z
        .string()
        .trim()
        .uuid(
          "Comment ID must be a valid UUID.",
        ),
    })
    .strict(),

  body: z
    .object({})
    .strict()
    .optional(),

  query: z
    .object({})
    .strict(),
});

export {
  MAX_COMMENT_LENGTH,
  DEFAULT_COMMENTS_LIMIT,
  MAX_COMMENTS_LIMIT,
  createPostCommentSchema,
  deleteCommentSchema,
  getPostCommentsSchema,
  
};