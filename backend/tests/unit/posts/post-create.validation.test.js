import {
  createPostSchema,
} from "../../../src/modules/posts/validations/post-create.validation.js";

const baseRequest = {
  params: {},
  query: {},
  body: {
    googleId:
      "ChIJArticternPostCreateTest",
    existingAssetIds: [],
    mediaOrder: [],
    itineraryIds: [],
    taggedUserIds: [],
  },
};

describe("create post caption validation", () => {
  test("accepts an omitted caption", () => {
    const result =
      createPostSchema.safeParse(
        baseRequest,
      );

    expect(result.success).toBe(true);
    expect(result.data.body.caption)
      .toBeUndefined();
  });

  test("treats a blank multipart caption as omitted", () => {
    const result =
      createPostSchema.safeParse({
        ...baseRequest,
        body: {
          ...baseRequest.body,
          caption: "   ",
        },
      });

    expect(result.success).toBe(true);
    expect(result.data.body.caption)
      .toBeUndefined();
  });

  test("continues to trim a supplied caption", () => {
    const result =
      createPostSchema.safeParse({
        ...baseRequest,
        body: {
          ...baseRequest.body,
          caption: "  Delhi evening  ",
        },
      });

    expect(result.success).toBe(true);
    expect(result.data.body.caption)
      .toBe("Delhi evening");
  });
});
