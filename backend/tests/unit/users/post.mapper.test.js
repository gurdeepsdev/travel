import PostMapper
  from "../../../src/modules/users/mappers/post.mapper.js";

describe(
  "PostMapper",
  () => {
    test(
      "includes the author profile share URL",
      () => {
        const result =
          PostMapper.toResponse({
            id:
              "44444444-4444-4444-8444-444444444444",
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",
            username:
              "user_98ef01e9",
            assets:
              [],
            itineraries:
              [],
          });

        expect(
          result.author
            .shareprofile_url,
        ).toBe(
          "https://artictern.com/u/user_98ef01e9",
        );
      },
    );
  },
);
