import { z } from "zod";

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 50;
const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 250;

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
    /^[a-z0-9_]+$/,
    "Username can contain only lowercase letters, numbers, and underscores.",
  );

const displayNameSchema = z
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
  .nullable();

const bioSchema = z
  .string({
    error:
      "Bio must be a string.",
  })
  .trim()
  .max(
    MAX_BIO_LENGTH,
    `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`,
  )
  .nullable();

const nullableUuidSchema = (
  invalidMessage,
) =>
  z
    .uuid({
      error: invalidMessage,
    })
    .nullable();

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
      .boolean({
        error:
          "Profile visibility must be a boolean.",
      })
      .optional(),
  })
  .strict()
  .refine(
    (body) =>
      Object.keys(body).length > 0,
    {
      message:
        "At least one profile field must be provided.",
    },
  );

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

export {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  updateMyProfileSchema,
};