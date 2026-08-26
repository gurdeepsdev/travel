import {
  getMySavedPostGroupsSchema,
  getMySavedPostsSchema,
} from "../../../src/modules/users/validations/saved-content.validation.js";

describe("saved-content validation", () => {
  test("preserves the unfiltered saved-post request", () => {
    const result =
      getMySavedPostsSchema.safeParse({
        params: {},
        body: undefined,
        query: {},
      });

    expect(result.success).toBe(true);
    expect(result.data.query)
      .toEqual({ limit: 20 });
  });

  test("accepts one saved-post location filter", () => {
    const result =
      getMySavedPostsSchema.safeParse({
        params: {},
        body: undefined,
        query: {
          cityId:
            "994ea28a-6ad8-4542-9740-c7d8d48696aa",
        },
      });

    expect(result.success).toBe(true);
  });

  test("rejects city and country filters together", () => {
    const result =
      getMySavedPostsSchema.safeParse({
        params: {},
        body: undefined,
        query: {
          cityId:
            "994ea28a-6ad8-4542-9740-c7d8d48696aa",
          countryId:
            "b35eb012-7342-48d2-b387-b081a8c0dbb7",
        },
      });

    expect(result.success).toBe(false);
  });

  test("requires a supported grouping dimension", () => {
    const result =
      getMySavedPostGroupsSchema.safeParse({
        params: {},
        body: undefined,
        query: {
          groupBy: "place",
        },
      });

    expect(result.success).toBe(false);
  });
});
