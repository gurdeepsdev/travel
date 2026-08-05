import {
  z,
} from "zod";

const getAssetContentSchema =
  z.object({
    params: z
      .object({
        assetId: z
          .string()
          .trim()
          .uuid(
            "Asset ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .unknown()
      .optional(),

    query: z
      .object({})
      .strict(),
  });

export {
  getAssetContentSchema,
};