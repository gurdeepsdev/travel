import {
  z,
} from "zod";

const MAX_ITINERARY_JSON_BYTES =
  900 * 1024;
const DEFAULT_ITINERARY_LIMIT = 20;
const MAX_ITINERARY_LIMIT = 50;
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

const itineraryItemSchema = z
  .object({
    item_type: z
      .string()
      .trim()
      .min(1)
      .max(50),
  })
  .passthrough();

const itineraryDaySchema = z
  .object({
    day: z
      .number()
      .int()
      .positive()
      .max(365),

    items: z
      .array(
        itineraryItemSchema,
      )
      .max(500),
  })
  .passthrough();

const itineraryPayloadSchema = z
  .object({
    request_id: z
      .string()
      .trim()
      .uuid(
        "Request ID must be a valid UUID.",
      ),

    status: z.literal(
      "success",
    ),

    mode: z
      .string()
      .trim()
      .min(1)
      .max(50),

    city_id: z
      .string()
      .trim()
      .min(
        1,
        "City ID is required.",
      )
      .max(255),

    summary: z
      .object({
        num_days: z
          .number()
          .int()
          .positive()
          .max(365),

        total_places: z
          .number()
          .int()
          .nonnegative(),
      })
      .passthrough(),

    days: z
      .array(
        itineraryDaySchema,
      )
      .min(
        1,
        "At least one itinerary day is required.",
      )
      .max(365),
  })
  .passthrough()
  .superRefine(
    (
      payload,
      context,
    ) => {
      if (
        payload.summary.num_days !==
        payload.days.length
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: [
            "summary",
            "num_days",
          ],
          message:
            "Summary day count must match days.",
        });
      }

      const uniqueDays =
        new Set(
          payload.days.map(
            (day) => day.day,
          ),
        );

      if (
        uniqueDays.size !==
        payload.days.length
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: ["days"],
          message:
            "Itinerary day numbers must be unique.",
        });
      }

      const byteLength =
        Buffer.byteLength(
          JSON.stringify(
            payload,
          ),
          "utf8",
        );

      if (
        byteLength >
        MAX_ITINERARY_JSON_BYTES
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          message:
            "Itinerary JSON cannot exceed 900 KB.",
        });
      }
    },
  );

const saveItinerarySchema = z
  .object({
    body:
      itineraryPayloadSchema,

    params: z
      .object({})
      .strict(),

    query: z
      .object({})
      .strict(),
  });

const getItinerarySchema = z
  .object({
    body: z
      .object({})
      .strict()
      .optional(),

    params: z
      .object({
        itineraryId: z
          .string()
          .trim()
          .uuid(
            "Itinerary ID must be a valid UUID.",
          ),
      })
      .strict(),

    query: z
      .object({})
      .strict(),
  });

const listItinerariesSchema = z
  .object({
    body: z
      .unknown()
      .optional(),

    params: z
      .object({})
      .strict(),

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
            MAX_ITINERARY_LIMIT,
            `Limit cannot exceed ${MAX_ITINERARY_LIMIT}.`,
          )
          .default(
            DEFAULT_ITINERARY_LIMIT,
          ),

        cursor:
          cursorSchema.optional(),
      })
      .strict(),
  });

export {
  DEFAULT_ITINERARY_LIMIT,
  MAX_ITINERARY_LIMIT,
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
};
