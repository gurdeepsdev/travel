import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 50;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 250;

function parseMultipartNull(
  value,
) {
  return value === "null"
    ? null
    : value;
}

function parseMultipartBoolean(
  value,
) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

const usernameSchema = z
  .string({
    error:
      "Username must be a string.",
  })
  .trim()
  .min(
    MIN_USERNAME_LENGTH,
    `Username must contain at least ${MIN_USERNAME_LENGTH} characters.`,
  )
  .max(
    MAX_USERNAME_LENGTH,
    `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`,
  )
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can contain only letters, numbers, and underscores.",
  )
  .transform(
    (username) =>
      username.toLowerCase(),
  );

const displayNameSchema = z
  .preprocess(
    parseMultipartNull,

    z
      .string({
        error:
          "Display name must be a string.",
      })
      .trim()
      .min(
        1,
        "Display name cannot be empty.",
      )
      .max(
        MAX_DISPLAY_NAME_LENGTH,
        `Display name cannot exceed ${MAX_DISPLAY_NAME_LENGTH} characters.`,
      )
      .nullable(),
  );

const bioSchema = z
  .preprocess(
    parseMultipartNull,

    z
      .string({
        error:
          "Bio must be a string.",
      })
      .trim()
      .max(
        MAX_BIO_LENGTH,
        `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`,
      )
      .nullable(),
  );

const nullableUuidSchema = (
  invalidMessage,
) =>
  z.preprocess(
    parseMultipartNull,

    z
      .uuid({
        error:
          invalidMessage,
      })
      .nullable(),
  );

const updateMyProfileBodySchema = z
  .object({
    username:
      usernameSchema.optional(),

    displayName:
      displayNameSchema.optional(),

    bio:
      bioSchema.optional(),

    profilePhotoAssetId:
      nullableUuidSchema(
        "Profile photo asset ID must be a valid UUID.",
      ).optional(),

    countryId:
      nullableUuidSchema(
        "Country ID must be a valid UUID.",
      ).optional(),

    cityId:
      nullableUuidSchema(
        "City ID must be a valid UUID.",
      ).optional(),

   isPrivate: z
      .preprocess(
        parseMultipartBoolean,

        z.boolean({
          error:
            "Profile visibility must be a boolean.",
        }),
      )
      .optional(),
  })
  .strict()
 

const updateMyProfileSchema = z.object({
  params: z
    .object({})
    .strict(),

  body:
    updateMyProfileBodySchema,

  query: z
    .object({})
    .strict(),
});



const getUserProfileSchema = z.object({
  params: z
    .object({
      username:
        usernameSchema,
    })
    .strict(),

  body:
    z.unknown().optional(),

  query: z
    .object({})
    .strict(),
});


export {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  getUserProfileSchema,
  updateMyProfileSchema,
};
