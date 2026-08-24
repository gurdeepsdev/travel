import {
  z,
} from "zod";

const MAX_ITINERARY_JSON_BYTES =
  900 * 1024;

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

export {
  getItinerarySchema,
  saveItinerarySchema,
};
