import {
  z,
} from "zod";

import {
  MAX_POST_MEDIA_FILES,
} from "../middleware/post-media-upload.middleware.js";

const MAX_POST_CAPTION_LENGTH = 250;
const MAX_POST_ITINERARIES = 5;
const MAX_POST_TAGGED_USERS = 20;
const MAX_MULTIPART_JSON_LENGTH =
  64 * 1024;

const uuidSchema = ({
  field,
}) =>
  z
    .string({
      error:
        `${field} must be a string.`,
    })
    .trim()
    .uuid(
      `${field} must be a valid UUID.`,
    );

function hasUniqueValues(
  values,
  selectValue = (
    value,
  ) => value,
) {
  const selected =
    values.map(selectValue);

  return (
    new Set(selected).size ===
    selected.length
  );
}

function createJsonArraySchema({
  field,
  itemSchema,
  maximumItems,
}) {
  const arraySchema = z
    .array(
      itemSchema,
      {
        error:
          `${field} must be an array.`,
      },
    )
    .max(
      maximumItems,
      `${field} cannot contain more than ${maximumItems} items.`,
    );

  const jsonStringSchema = z
    .string({
      error:
        `${field} must be a JSON array.`,
    })
    .trim()
    .min(
      1,
      `${field} cannot be empty.`,
    )
    .max(
      MAX_MULTIPART_JSON_LENGTH,
      `${field} is too large.`,
    )
    .transform(
      (
        value,
        context,
      ) => {
        try {
          return JSON.parse(value);
        } catch {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            message:
              `${field} must contain valid JSON.`,
          });

          return z.NEVER;
        }
      },
    )
    .pipe(arraySchema);

  return z
    .union([
      arraySchema,
      jsonStringSchema,
    ])
    .optional()
    .default([]);
}

const existingAssetIdsSchema =
  createJsonArraySchema({
    field:
      "Existing asset IDs",

    itemSchema:
      uuidSchema({
        field:
          "Existing asset ID",
      }),

    maximumItems:
      MAX_POST_MEDIA_FILES,
  })
    .refine(
      hasUniqueValues,
      {
        message:
          "Existing asset IDs must be unique.",
      },
    );

const itineraryIdsSchema =
  createJsonArraySchema({
    field:
      "Itinerary IDs",

    itemSchema:
      uuidSchema({
        field:
          "Itinerary ID",
      }),

    maximumItems:
      MAX_POST_ITINERARIES,
  })
    .refine(
      hasUniqueValues,
      {
        message:
          "Itinerary IDs must be unique.",
      },
    );

const taggedUserIdsSchema =
  createJsonArraySchema({
    field:
      "Tagged user IDs",

    itemSchema:
      uuidSchema({
        field:
          "Tagged user ID",
      }),

    maximumItems:
      MAX_POST_TAGGED_USERS,
  })
    .refine(
      hasUniqueValues,
      {
        message:
          "Tagged user IDs must be unique.",
      },
    );

const existingMediaOrderSchema = z
  .object({
    source: z.literal(
      "EXISTING",
    ),

    assetId:
      uuidSchema({
        field:
          "Media-order asset ID",
      }),
  })
  .strict();

const uploadedMediaOrderSchema = z
  .object({
    source: z.literal(
      "UPLOAD",
    ),

    fileIndex: z
      .number({
        error:
          "Media-order file index must be a number.",
      })
      .int(
        "Media-order file index must be an integer.",
      )
      .min(
        0,
        "Media-order file index cannot be negative.",
      )
      .max(
        MAX_POST_MEDIA_FILES - 1,
        "Media-order file index is outside the allowed range.",
      ),
  })
  .strict();

const mediaOrderItemSchema =
  z.discriminatedUnion(
    "source",
    [
      existingMediaOrderSchema,
      uploadedMediaOrderSchema,
    ],
    {
      error:
        "Media-order source must be EXISTING or UPLOAD.",
    },
  );

const mediaOrderSchema =
  createJsonArraySchema({
    field:
      "Media order",

    itemSchema:
      mediaOrderItemSchema,

    maximumItems:
      MAX_POST_MEDIA_FILES,
  })
    .refine(
      (items) =>
        hasUniqueValues(
          items.filter(
            (item) =>
              item.source ===
              "EXISTING",
          ),
          (item) =>
            item.assetId,
        ),
      {
        message:
          "Media order cannot reference an existing asset more than once.",
      },
    )
    .refine(
      (items) =>
        hasUniqueValues(
          items.filter(
            (item) =>
              item.source ===
              "UPLOAD",
          ),
          (item) =>
            item.fileIndex,
        ),
      {
        message:
          "Media order cannot reference an uploaded file more than once.",
      },
    );

const createPostBodySchema = z
  .object({
    caption: z.preprocess(
      (value) =>
        typeof value === "string" &&
        value.trim() === ""
          ? undefined
          : value,
      z
        .string({
          error:
            "Caption must be a string.",
        })
        .trim()
        .max(
          MAX_POST_CAPTION_LENGTH,
          `Caption cannot exceed ${MAX_POST_CAPTION_LENGTH} characters.`,
        )
        .optional(),
    ),

    visibility: z
      .enum(
        [
          "PUBLIC",
          "PRIVATE",
        ],
        {
          error:
            "Visibility must be PUBLIC or PRIVATE.",
        },
      )
      .default("PUBLIC"),

    placeId:
      uuidSchema({
        field:
          "Place ID",
      })
        .optional(),

    googleId: z
      .string({
        error:
          "Google ID must be a string.",
      })
      .trim()
      .min(
        1,
        "Google ID cannot be empty.",
      )
      .max(
        255,
        "Google ID cannot exceed 255 characters.",
      )
      .optional(),

    existingAssetIds:
      existingAssetIdsSchema,

    mediaOrder:
      mediaOrderSchema,

    itineraryIds:
      itineraryIdsSchema,

    taggedUserIds:
      taggedUserIdsSchema,
  })
  .strict()
  .superRefine(
    (
      body,
      context,
    ) => {
      const placeReferenceCount = [
        body.placeId,
        body.googleId,
      ].filter(Boolean).length;

      if (
        placeReferenceCount !== 1
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            "placeId",
          ],

          message:
            "Provide either placeId or googleId, but not both.",
        });
      }

      const existingOrderAssetIds =
        body.mediaOrder
          .filter(
            (item) =>
              item.source ===
              "EXISTING",
          )
          .map(
            (item) =>
              item.assetId,
          );

      const allowedExistingAssetIds =
        new Set(
          body.existingAssetIds,
        );

      for (
        const assetId of
        existingOrderAssetIds
      ) {
        if (
          !allowedExistingAssetIds
            .has(assetId)
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "mediaOrder",
            ],

            message:
              "Media order references an asset that is not present in existingAssetIds.",
          });

          break;
        }
      }
    },
  );

const createPostSchema = z.object({
  params: z
    .object({})
    .strict(),

  body:
    createPostBodySchema,

  query: z
    .object({})
    .strict(),
});

export {
  MAX_POST_CAPTION_LENGTH,
  MAX_POST_ITINERARIES,
  MAX_POST_TAGGED_USERS,
  createPostSchema,
};
