import { z } from "zod";

const DEFAULT_POSTS_LIMIT = 20;
const MAX_POSTS_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;

const cursorSchema = z
  .string()
  .trim()
  .min(1, "Cursor cannot be empty.")
  .max(
    MAX_CURSOR_LENGTH,
    `Cursor cannot exceed ${MAX_CURSOR_LENGTH} characters.`,
  )
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Cursor must be a valid Base64 URL-safe value.",
  );

const getMyPostsSchema = z.object({
  body: z.unknown().optional(),

  params: z.object({}).optional(),

  query: z
    .object({
      limit: z.coerce
        .number({
          error: "Limit must be a number.",
        })
        .int("Limit must be an integer.")
        .min(1, "Limit must be at least 1.")
        .max(
          MAX_POSTS_LIMIT,
          `Limit cannot exceed ${MAX_POSTS_LIMIT}.`,
        )
        .default(DEFAULT_POSTS_LIMIT),

      cursor: cursorSchema.optional(),
    })
    .strict(),
});

export {
  DEFAULT_POSTS_LIMIT,
  MAX_POSTS_LIMIT,
  getMyPostsSchema,
};
