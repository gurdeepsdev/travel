import {
  removePostRepostSchema,
  setPostRepostSchema,
} from "../../../src/modules/posts/validations/post-reposts.validation.js";

const POST_ID =
  "11111111-1111-4111-8111-111111111111";

describe(
  "post repost validation",
  () => {
    test.each([
      [
        "an empty body",
        {},
      ],
      [
        "a trimmed message",
        {
          message:
            "Worth visiting",
        },
      ],
    ])(
      "accepts %s",
      (
        _name,
        body,
      ) => {
        expect(
          setPostRepostSchema
            .safeParse({
              params: {
                postId:
                  POST_ID,
              },
              query: {},
              body,
            })
            .success,
        ).toBe(true);
      },
    );

    test.each([
      [
        "an empty message",
        {
          message:
            "   ",
        },
      ],
      [
        "an oversized message",
        {
          message:
            "x".repeat(251),
        },
      ],
      [
        "an unknown field",
        {
          unexpected:
            true,
        },
      ],
    ])(
      "rejects %s",
      (
        _name,
        body,
      ) => {
        expect(
          setPostRepostSchema
            .safeParse({
              params: {
                postId:
                  POST_ID,
              },
              query: {},
              body,
            })
            .success,
        ).toBe(false);
      },
    );

    test(
      "accepts an empty delete request",
      () => {
        expect(
          removePostRepostSchema
            .safeParse({
              params: {
                postId:
                  POST_ID,
              },
              query: {},
            })
            .success,
        ).toBe(true);
      },
    );
  },
);
