import {
  getUserProfileSchema,
  updateMyProfileSchema,
} from "../../../src/modules/users/validations/profile.validation.js";

describe("profile username validation", () => {
  test(
    "normalizes an uppercase username during profile update",
    () => {
      const result =
        updateMyProfileSchema.parse({
          params: {},
          body: {
            username:
              "Gurdeep_DEV01",
          },
          query: {},
        });

      expect(result.body.username)
        .toBe("gurdeep_dev01");
    },
  );

  test(
    "normalizes an uppercase username lookup",
    () => {
      const result =
        getUserProfileSchema.parse({
          params: {
            username:
              "Gurdeep_DEV01",
          },
          body: undefined,
          query: {},
        });

      expect(result.params.username)
        .toBe("gurdeep_dev01");
    },
  );

  test(
    "continues to reject unsupported username characters",
    () => {
      const result =
        updateMyProfileSchema
          .safeParse({
            params: {},
            body: {
              username:
                "gurdeep-dev",
            },
            query: {},
          });

      expect(result.success)
        .toBe(false);
    },
  );
});
