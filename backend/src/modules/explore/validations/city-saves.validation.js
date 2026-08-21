import { z } from "zod";

const cityIdParamsSchema = z
  .object({
    cityId: z
      .string()
      .trim()
      .uuid(
        "City ID must be a valid UUID.",
      ),
  })
  .strict();

const citySaveSchema = z.object({
  params: cityIdParamsSchema,

  body: z
    .object({})
    .strict()
    .optional(),

  query: z
    .object({})
    .strict(),
});

export {
  citySaveSchema,
};
