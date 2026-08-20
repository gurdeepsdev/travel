import {
  z,
} from "zod";

const deletePostSchema = z.object({
  params: z
    .object({
      postId: z
        .string({
          error:
            "Post ID must be a string.",
        })
        .trim()
        .uuid(
          "Post ID must be a valid UUID.",
        ),
    })
    .strict(),

  body: z
    .object({})
    .strict(),

  query: z
    .object({})
    .strict(),
});

export {
  deletePostSchema,
};
