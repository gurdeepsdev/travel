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

const getAssetStreamResourceSchema =
  z.object({
    params: z
      .object({
        assetId: z
          .string()
          .trim()
          .uuid(
            "Asset ID must be a valid UUID.",
          ),
        rendition: z.enum([
          "360p",
          "540p",
          "720p",
        ]),
        fileName: z
          .string()
          .regex(
            /^(?:index\.m3u8|segment_\d{6}\.ts)$/,
            "HLS resource name is invalid.",
          ),
      })
      .strict(),

    body: z.unknown().optional(),
    query: z.object({}).strict(),
  });

export {
  getAssetContentSchema,
  getAssetStreamResourceSchema,
};
