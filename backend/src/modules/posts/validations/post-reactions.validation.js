import { z } from "zod";

import {
  POST_REACTION_VALUES,
} from "../post-reactions.constants.js";


const DEFAULT_REACTIONS_LIMIT = 20;
const MAX_REACTIONS_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;

const reactionCursorSchema = z
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

  const getPostReactionsSchema = z.object({
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
      reactionType: z
        .enum(
          POST_REACTION_VALUES,
          {
            error:
              "Reaction type is not supported.",
          },
        )
        .optional(),

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
          MAX_REACTIONS_LIMIT,
          `Limit cannot exceed ${MAX_REACTIONS_LIMIT}.`,
        )
        .default(
          DEFAULT_REACTIONS_LIMIT,
        ),

      cursor:
        reactionCursorSchema.optional(),
    })
    .strict(),
});
const postIdParamsSchema = z
  .object({
    postId: z
      .string()
      .trim()
      .uuid("Post ID must be a valid UUID."),
  })
  .strict();

const setPostReactionSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({
      reactionType: z.enum(
        POST_REACTION_VALUES,
        {
          error: "Reaction type is not supported.",
        },
      ),
    })
    .strict(),

  query: z.object({}).strict(),
});

const removePostReactionSchema = z.object({
  params: postIdParamsSchema,

  body: z
    .object({})
    .strict()
    .optional(),

  query: z.object({}).strict(),
});

export {
    DEFAULT_REACTIONS_LIMIT,
  MAX_REACTIONS_LIMIT,
  setPostReactionSchema,
  removePostReactionSchema,
    getPostReactionsSchema,

};