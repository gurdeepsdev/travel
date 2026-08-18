import { z } from "zod";

const REPORT_REASON_CODES =
  Object.freeze([
    "SPAM",
    "HARASSMENT",
    "HATE_SPEECH",
    "NUDITY_OR_SEXUAL_CONTENT",
    "VIOLENCE",
    "MISINFORMATION",
    "IMPERSONATION",
    "INTELLECTUAL_PROPERTY",
    "OTHER",
  ]);

const reportBodySchema = z
  .object({
    reasonCode: z.enum(
      REPORT_REASON_CODES,
      {
        error:
          "Report reason is invalid.",
      },
    ),

    description: z
      .string({
        error:
          "Description must be a string.",
      })
      .trim()
      .min(
        1,
        "Description cannot be empty.",
      )
      .max(
        500,
        "Description cannot exceed 500 characters.",
      )
      .optional(),
  })
  .strict();

const reportUserSchema = z.object({
  params: z
    .object({
      userId: z
        .string({
          error:
            "User ID must be a string.",
        })
        .trim()
        .uuid(
          "User ID must be a valid UUID.",
        ),
    })
    .strict(),

  body:
    reportBodySchema,

  query: z
    .object({})
    .strict(),
});

const reportPostSchema = z.object({
  params: z
    .object({
      postId: z
        .string({
          error:
            "Post ID must be a string.",
        })
        .trim()
        .uuid(
          "Post ID must be a valid UUID.",
        ),
    })
    .strict(),

  body:
    reportBodySchema,

  query: z
    .object({})
    .strict(),
});

export {
  REPORT_REASON_CODES,
  reportPostSchema,
  reportUserSchema,
};
