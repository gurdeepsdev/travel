import ProfileMapper from "../../../src/modules/users/mappers/profile.mapper.js";

describe("ProfileMapper toPublicResponse", () => {
  test("includes the user ID and privacy state", () => {
    const result =
      ProfileMapper.toPublicResponse({
        user_id:
          "b3fe5214-e569-4300-8509-589785ad86f2",
        username:
          "user_98ef01e9",
        is_private:
          true,
      });

    expect(result).toMatchObject({
      userId:
        "b3fe5214-e569-4300-8509-589785ad86f2",
      username:
        "user_98ef01e9",
      shareUrl:
        "https://artictern.com/u/user_98ef01e9",
      isPrivate:
        true,
    });
  });
});
