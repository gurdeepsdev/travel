import {
  z,
} from "zod";

const DEFAULT_POST_LIMIT =
  20;

const MAX_POST_LIMIT =
  50;

const EXPLORE_CITY_CATEGORIES = [
  "FOR_YOU",
  "PEACEFUL",
  "FUN",
  "HISTORY_AND_CULTURE",
  "ADVENTURE",
];

const exploreCityCategorySchema = z
  .string({
    error:
      "Category must be a string.",
  })
  .trim()
  .max(
    50,
    "Category cannot exceed 50 characters.",
  )
  .transform(
    (value) =>
      value === ""
        ? "FOR_YOU"
        : value
            .toUpperCase()
            .replace(
              /[\s-]+/g,
              "_",
            ),
  )
  .pipe(
    z.enum(
      EXPLORE_CITY_CATEGORIES,
      {
        error:
          "Category must be For You, Peaceful, Fun, History and Culture, or Adventure.",
      },
    ),
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

const getExploreFeedSchema =
  z.object({
    params: z
      .object({})
      .strict(),

    body: z
      .unknown()
      .optional(),

    query: z
      .object({
        latitude: z.coerce
          .number({
            error:
              "Latitude must be a number.",
          })
          .min(
            -90,
            "Latitude cannot be below -90.",
          )
          .max(
            90,
            "Latitude cannot exceed 90.",
          )
          .optional(),

        longitude: z.coerce
          .number({
            error:
              "Longitude must be a number.",
          })
          .min(
            -180,
            "Longitude cannot be below -180.",
          )
          .max(
            180,
            "Longitude cannot exceed 180.",
          )
          .optional(),

        radiusKm: z.coerce
          .number({
            error:
              "Radius must be a number.",
          })
          .positive(
            "Radius must be greater than zero.",
          )
          .max(
            500,
            "Radius cannot exceed 500 kilometres.",
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
            MAX_POST_LIMIT,
            `Limit cannot exceed ${MAX_POST_LIMIT}.`,
          )
          .default(
            DEFAULT_POST_LIMIT,
          ),

        cursor:
          cursorSchema
            .optional(),
      })
      .strict()
      .superRefine(
        (
          query,
          context,
        ) => {
          const hasLatitude =
            query.latitude !==
            undefined;

          const hasLongitude =
            query.longitude !==
            undefined;

          if (
            hasLatitude !==
            hasLongitude
          ) {
            context.addIssue({
              code:
                "custom",

              message:
                "Latitude and longitude must be provided together.",
            });
          }

          if (
            query.radiusKm !==
              undefined &&
            !hasLatitude
          ) {
            context.addIssue({
              code:
                "custom",

              message:
                "Radius requires latitude and longitude.",
            });
          }
        },
      ),
  });

const getExploreVideosSchema =
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
            MAX_POST_LIMIT,
            `Limit cannot exceed ${MAX_POST_LIMIT}.`,
          )
          .default(
            DEFAULT_POST_LIMIT,
          ),

        cursor:
          cursorSchema
            .optional(),
      })
      .strict(),
  });


const getExploreCitiesSchema =
  z.object({
    params:
      z.object({})
        .strict(),

    body:
      z.unknown()
        .optional(),

    query:
      z.object({
        category:
          exploreCityCategorySchema
            .optional()
            .default(
              "FOR_YOU",
            ),

        limit:
          z.coerce
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
              20,
              "Limit cannot exceed 20.",
            )
            .default(
              10,
            ),
      })
      .strict(),
  })
  .strict();

const getExploreCountriesSchema =
  z.object({
    params: z.object({})
      .strict(),
    body: z.unknown()
      .optional(),
    query: z.object({
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
          20,
          "Limit cannot exceed 20.",
        )
        .default(10),
    })
      .strict(),
  })
  .strict();

const getExploreCityPlacesSchema =
  z.object({
    params:
      z.object({
        cityId:
          z.string({
            error:
              "City ID is required.",
          })
            .uuid(
              "City ID must be a valid UUID.",
            ),
      })
      .strict(),

    body:
      z.unknown()
        .optional(),

    query:
      z.object({
        limit:
          z.coerce
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
              50,
              "Limit cannot exceed 50.",
            )
            .default(
              20,
            ),
      })
      .strict(),
  })
  .strict();

const getExplorePlacesSchema =
  z.object({
    params:
      z.object({})
        .strict(),

    body:
      z.unknown()
        .optional(),

    query:
      z.object({
        latitude:
          z.coerce
            .number({
              error:
                "Latitude must be a number.",
            })
            .min(
              -90,
              "Latitude cannot be below -90.",
            )
            .max(
              90,
              "Latitude cannot exceed 90.",
            )
            .optional(),

        longitude:
          z.coerce
            .number({
              error:
                "Longitude must be a number.",
            })
            .min(
              -180,
              "Longitude cannot be below -180.",
            )
            .max(
              180,
              "Longitude cannot exceed 180.",
            )
            .optional(),

        radiusKm:
          z.coerce
            .number({
              error:
                "Radius must be a number.",
            })
            .positive(
              "Radius must be greater than zero.",
            )
            .max(
              500,
              "Radius cannot exceed 500 kilometres.",
            )
            .default(
              50,
            ),

        limit:
          z.coerce
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
              20,
              "Limit cannot exceed 20.",
            )
            .default(
              10,
            ),
      })
      .strict()
      .superRefine(
        (
          query,
          context,
        ) => {
          const hasLatitude =
            query.latitude !==
            undefined;

          const hasLongitude =
            query.longitude !==
            undefined;

          if (
            hasLatitude !==
            hasLongitude
          ) {
            context.addIssue({
              code:
                "custom",

              message:
                "Latitude and longitude must be provided together.",
            });
          }
        },
      ),
  })
  .strict();

export {
  EXPLORE_CITY_CATEGORIES,
  getExploreCountriesSchema,
  getExploreFeedSchema,
  getExploreVideosSchema,
  getExploreCitiesSchema,
  getExploreCityPlacesSchema,
  getExplorePlacesSchema,
};
