import { z } from "zod";

const DEFAULT_BLOCKED_USERS_LIMIT =
  20;

const MAX_BLOCKED_USERS_LIMIT =
  50;

const userIdSchema = z
  .string({
    error:
      "User ID must be a string.",
  })
  .trim()
  .uuid(
    "User ID must be a valid UUID.",
  );

const cursorSchema = z
  .string({
    error:
      "Cursor must be a string.",
  })
  .trim()
  .min(
    1,
    "Cursor cannot be empty.",
  )
  .max(
    1024,
    "Cursor cannot exceed 1024 characters.",
  )
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Cursor must be a valid Base64 URL-safe value.",
  );

const blockUserSchema =
  z.object({
    params: z
      .object({
        userId:
          userIdSchema,
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

const unblockUserSchema =
  blockUserSchema;

const getBlockedUsersSchema =
  z.object({
    params: z
      .object({})
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
            MAX_BLOCKED_USERS_LIMIT,
            `Limit cannot exceed ${MAX_BLOCKED_USERS_LIMIT}.`,
          )
          .default(
            DEFAULT_BLOCKED_USERS_LIMIT,
          ),

        cursor:
          cursorSchema
            .optional(),
      })
      .strict(),
  });

export {
  blockUserSchema,
  unblockUserSchema,
  getBlockedUsersSchema,
};
