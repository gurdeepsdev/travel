import { z } from "zod";

const DEFAULT_VISITED_PLACES_LIMIT =
  20;

const MAX_VISITED_PLACES_LIMIT =
  50;

const MAX_VISITED_PLACES_CURSOR_LENGTH =
  1024;

const visitedPlacesCursorSchema = z
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
    MAX_VISITED_PLACES_CURSOR_LENGTH,
    `Cursor cannot exceed ${MAX_VISITED_PLACES_CURSOR_LENGTH} characters.`,
  )
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Cursor must be a valid Base64 URL-safe value.",
  );


const updateVisitedCollectionPreferenceSchema =
  z.object({
    params: z
      .object({
        collectionId: z
          .string({
            error:
              "Collection ID must be a string.",
          })
          .trim()
          .uuid(
            "Collection ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({
        isPreference: z
          .boolean({
            error:
              "isPreference must be a boolean.",
          }),
      })
      .strict(),

    query: z
      .object({})
      .strict(),
  });

const submitVisitedPlaceVerificationSchema =
  z.object({
    params: z
      .object({})
      .strict(),

    body: z
      .object({
        placeId: z
          .string({
            error:
              "Place ID must be a string.",
          })
          .trim()
          .uuid(
            "Place ID must be a valid UUID.",
          )
          .optional(),

        googlePlaceId: z
          .string({
            error:
              "Google Place ID must be a string.",
          })
          .trim()
          .min(
            1,
            "Google Place ID cannot be empty.",
          )
          .max(
            255,
            "Google Place ID cannot exceed 255 characters.",
          )
          .optional(),

        googleCityPlaceId: z
          .string({
            error:
              "Google city Place ID must be a string.",
          })
          .trim()
          .min(
            1,
            "Google city Place ID cannot be empty.",
          )
          .max(
            255,
            "Google city Place ID cannot exceed 255 characters.",
          )
          .optional(),

        claimedVisitedAt: z
          .iso
          .datetime({
            offset:
              true,

            error:
              "Claimed visit time must be a valid ISO-8601 datetime with timezone.",
          })
          .optional(),
      })
      .strict()
      .superRefine(
        (
          value,
          context,
        ) => {
          const identifierCount =
            Number(
              Boolean(value.placeId),
            ) +
            Number(
              Boolean(
                value.googlePlaceId,
              ),
            );

          if (
            identifierCount > 1 ||
            (
              identifierCount === 0 &&
              !value.googleCityPlaceId
            )
          ) {
            context.addIssue({
              code:
                "custom",

              message:
                "Provide placeId, googlePlaceId, or googleCityPlaceId. Do not send placeId with googlePlaceId.",
            });
          }
        },
      ),

    query: z
      .object({})
      .strict(),
  });

  const getMyVisitedPlacesSchema =
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
            MAX_VISITED_PLACES_LIMIT,
            `Limit cannot exceed ${MAX_VISITED_PLACES_LIMIT}.`,
          )
          .default(
            DEFAULT_VISITED_PLACES_LIMIT,
          ),

        cursor:
          visitedPlacesCursorSchema
            .optional(),
      })
      .strict(),
  });

export {
  DEFAULT_VISITED_PLACES_LIMIT,
  MAX_VISITED_PLACES_LIMIT,
  submitVisitedPlaceVerificationSchema,
  updateVisitedCollectionPreferenceSchema,
  getMyVisitedPlacesSchema,
};
