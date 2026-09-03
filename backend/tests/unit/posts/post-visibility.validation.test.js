import {
  updatePostVisibilitySchema,
} from "../../../src/modules/posts/validations/post-visibility.validation.js";

const POST_ID =
  "550e8400-e29b-41d4-a716-446655440000";

describe("post visibility validation", () => {
  test.each([
    "PUBLIC",
    "PRIVATE",
  ])("accepts %s", (visibility) => {
    expect(
      updatePostVisibilitySchema
        .safeParse({
          params: {
            postId: POST_ID,
          },
          body: {
            visibility,
          },
          query: {},
        }).success,
    ).toBe(true);
  });

  test("rejects unsupported visibility", () => {
    expect(
      updatePostVisibilitySchema
        .safeParse({
          params: {
            postId: POST_ID,
          },
          body: {
            visibility: "CONNECTED",
          },
          query: {},
        }).success,
    ).toBe(false);
  });
});
