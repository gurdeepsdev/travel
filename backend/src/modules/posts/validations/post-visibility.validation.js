import {
  z,
} from "zod";

const updatePostVisibilitySchema =
  z.object({
    params: z
      .object({
        postId: z
          .string()
          .trim()
          .uuid(
            "Post ID must be a valid UUID.",
          ),
      })
      .strict(),

    body: z
      .object({
        visibility: z.enum([
          "PUBLIC",
          "PRIVATE",
        ]),
      })
      .strict(),

    query: z
      .object({})
      .strict(),
  });

export {
  updatePostVisibilitySchema,
};
