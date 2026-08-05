import { z } from "zod";

const MEMORY_TYPES = Object.freeze([
  "IMAGE",
  "VIDEO",
  "BOOMERANG",
]);

const DEFAULT_MEMORIES_LIMIT = 20;
const MAX_MEMORIES_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1024;

const cursorSchema = z
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

const saveMemorySchema = z.object({
  params: z
    .object({})
    .strict(),

  body: z
    .object({
      assetId: z
        .string()
        .trim()
        .uuid(
          "Asset ID must be a valid UUID.",
        ),

      memoryType: z.enum(
        MEMORY_TYPES,
        {
          error:
            "Memory type must be IMAGE, VIDEO, or BOOMERANG.",
        },
      ),
    })
    .strict(),

  query: z
    .object({})
    .strict(),
});

const getMyMemoriesSchema = z.object({
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
          MAX_MEMORIES_LIMIT,
          `Limit cannot exceed ${MAX_MEMORIES_LIMIT}.`,
        )
        .default(
          DEFAULT_MEMORIES_LIMIT,
        ),

      cursor:
        cursorSchema.optional(),
    })
    .strict(),
});

export {
  MEMORY_TYPES,
  DEFAULT_MEMORIES_LIMIT,
  MAX_MEMORIES_LIMIT,
  saveMemorySchema,
  getMyMemoriesSchema,
};