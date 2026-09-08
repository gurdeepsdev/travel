import {
  createPostSchema,
} from "../../../src/modules/posts/validations/post-create.validation.js";

const baseRequest = {
  params: {},
  query: {},
  body: {
    cityId:
      "ChIJArticternGoogleCity",
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

describe("create post city validation", () => {
  test("requires cityId", () => {
    const result =
      createPostSchema.safeParse({
        ...baseRequest,
        body: {
          ...baseRequest.body,
          cityId: undefined,
        },
      });

    expect(result.success).toBe(false);
  });

  test.each([
    "ChIJArticternGoogleCity",
    "ChIJArticternGooglePlace",
  ])("accepts Google identifier %s", (cityId) => {
    const result =
      createPostSchema.safeParse({
        ...baseRequest,
        body: {
          ...baseRequest.body,
          cityId,
        },
      });

    expect(result.success).toBe(true);
  });

  test.each([
    ["placeId", "72bf8c7b-c684-4046-9f97-cfb1f569e59a"],
    ["googleId", "ChIJArticternPostCreateTest"],
  ])("rejects legacy %s", (field, value) => {
    const result =
      createPostSchema.safeParse({
        ...baseRequest,
        body: {
          ...baseRequest.body,
          [field]: value,
        },
      });

    expect(result.success).toBe(false);
  });
});
