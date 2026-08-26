import PostReactionsMapper
  from "../../../src/modules/posts/mappers/post-reactions.mapper.js";

describe("PostReactionsMapper", () => {
  test(
    "maps a local profile photo to the API content URL",
    () => {
      const previousBaseUrl =
        process.env.API_PUBLIC_BASE_URL;

      process.env.API_PUBLIC_BASE_URL =
        "https://apitest.artictern.com";

      const reaction =
        PostReactionsMapper.toListItem({
          id:
            "244adadd-60a6-4397-9a1f-45452449ca04",
          user_id:
            "7b8bc984-322d-4f27-811c-252fc3a61595",
          reaction_type: "LIKE",
          profile_photo_id:
            "de2b0aea-edb0-4790-8fb2-47ae5901bd42",
          profile_photo_storage_provider:
            "local",
          profile_photo_bucket: "local",
          profile_photo_storage_key:
            "profile-photos/user/photo.png",
          profile_photo_mime_type:
            "image/png",
        });

      expect(
        reaction.user.profilePhoto.url,
      ).toBe(
        "https://apitest.artictern.com/api/v1/media/assets/de2b0aea-edb0-4790-8fb2-47ae5901bd42/content",
      );

      if (
        previousBaseUrl === undefined
      ) {
        delete process.env
          .API_PUBLIC_BASE_URL;
      } else {
        process.env.API_PUBLIC_BASE_URL =
          previousBaseUrl;
      }
    },
  );
});
