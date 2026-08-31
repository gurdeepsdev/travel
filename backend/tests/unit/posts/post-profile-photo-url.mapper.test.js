import PostBeenThereMapper
  from "../../../src/modules/posts/mappers/post-been-there.mapper.js";
import PostCommentsMapper
  from "../../../src/modules/posts/mappers/post-comments.mapper.js";

const ASSET_ID =
  "de2b0aea-edb0-4790-8fb2-47ae5901bd42";
const EXPECTED_URL =
  `https://apitest.artictern.com/api/v1/media/assets/${ASSET_ID}/content`;

const profilePhotoRow = {
  id:
    "244adadd-60a6-4397-9a1f-45452449ca04",
  post_id:
    "364b4164-2083-4ab8-ba7e-d561b93a8966",
  user_id:
    "7b8bc984-322d-4f27-811c-252fc3a61595",
  profile_photo_id: ASSET_ID,
  profile_photo_storage_provider:
    "local",
  profile_photo_bucket: "local",
  profile_photo_storage_key:
    "profile-photos/user/photo.png",
  profile_photo_mime_type:
    "image/png",
};

describe(
  "post profile-photo URL mapping",
  () => {
    const previousBaseUrl =
      process.env.API_PUBLIC_BASE_URL;

    beforeAll(() => {
      process.env.API_PUBLIC_BASE_URL =
        "https://apitest.artictern.com";
    });

    afterAll(() => {
      if (
        previousBaseUrl === undefined
      ) {
        delete process.env
          .API_PUBLIC_BASE_URL;
      } else {
        process.env.API_PUBLIC_BASE_URL =
          previousBaseUrl;
      }
    });

    test(
      "maps a been-there local photo to the API content URL",
      () => {
        const visitor =
          PostBeenThereMapper
            .toListItem(
              profilePhotoRow,
            );

        expect(
          visitor.user.profilePhoto.url,
        ).toBe(EXPECTED_URL);
      },
    );

    test(
      "maps a comment local photo to the API content URL",
      () => {
        const comment =
          PostCommentsMapper.toComment({
            ...profilePhotoRow,
            comment: "Looks great",
          });

        expect(
          comment.author.profilePhoto.url,
        ).toBe(EXPECTED_URL);
      },
    );
  },
);
