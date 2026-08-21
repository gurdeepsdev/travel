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
      shareprofile_url:
        "https://artictern.com/u/user_98ef01e9",
      relationship:
        null,
      isPrivate:
        true,
    });
  });

  test(
    "maps the viewer relationship state",
    () => {
      const result =
        ProfileMapper.toPublicResponse(
          {
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",

            username:
              "user_98ef01e9",

            is_private:
              false,
          },
          {
            status:
              "OUTGOING_PENDING",

            connectionId:
              null,

            requestId:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
        );

      expect(
        result.relationship,
      ).toEqual({
        status:
          "OUTGOING_PENDING",

        connectionId:
          null,

        requestId:
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      });
    },
  );

  test(
    "includes the share URL in the authenticated profile response",
    () => {
      const result =
        ProfileMapper.toResponse({
          user_id:
            "b3fe5214-e569-4300-8509-589785ad86f2",
          username:
            "user_98ef01e9",
          is_private:
            false,
        });

      expect(result.shareprofile_url)
        .toBe(
          "https://artictern.com/u/user_98ef01e9",
        );
    },
  );
});
