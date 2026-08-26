import { z } from "zod";

const DEFAULT_SAVED_CONTENT_LIMIT = 20;
const MAX_SAVED_CONTENT_LIMIT = 50;
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

const paginationQuerySchema = z
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
        MAX_SAVED_CONTENT_LIMIT,
        `Limit cannot exceed ${MAX_SAVED_CONTENT_LIMIT}.`,
      )
      .default(
        DEFAULT_SAVED_CONTENT_LIMIT,
      ),

    cursor:
      cursorSchema.optional(),
  })
  .strict();

const getMySavedPostsSchema = z.object({
  params: z
    .object({})
    .strict(),

  body: z
    .unknown()
    .optional(),

  query: paginationQuerySchema
    .extend({
      cityId: z
        .string()
        .trim()
        .uuid(
          "City ID must be a valid UUID.",
        )
        .optional(),

      countryId: z
        .string()
        .trim()
        .uuid(
          "Country ID must be a valid UUID.",
        )
        .optional(),
    })
    .superRefine(
      (query, context) => {
        if (
          query.cityId &&
          query.countryId
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,
            message:
              "Provide either cityId or countryId, but not both.",
          });
        }
      },
    ),
});

const getMySavedPostGroupsSchema =
  z.object({
    params: z
      .object({})
      .strict(),

    body: z
      .unknown()
      .optional(),

    query: paginationQuerySchema
      .extend({
        groupBy: z.enum([
          "city",
          "country",
        ]),
      }),
  });

const getUserSavedPlacesSchema = z.object({
  params: z
    .object({
      username: z
        .string()
        .trim()
        .min(
          3,
          "Username must contain at least 3 characters.",
        )
        .max(
          50,
          "Username cannot exceed 50 characters.",
        ),
    })
    .strict(),

  body: z
    .unknown()
    .optional(),

  query: paginationQuerySchema,
});

export {
  DEFAULT_SAVED_CONTENT_LIMIT,
  MAX_SAVED_CONTENT_LIMIT,
  getMySavedPostGroupsSchema,
  getMySavedPostsSchema,
  getUserSavedPlacesSchema,
};
