import { jest } from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const COUNTRY_ID =
  "060de7c3-9c68-4507-aff7-62a5411bf60a";

const OTHER_COUNTRY_ID =
  "160de7c3-9c68-4507-aff7-62a5411bf60a";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";

const PHOTO_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const profilesRepositoryMock = {
  findByUserId:
    jest.fn(),

  findUpdateContext:
    jest.fn(),

  findUsernameConflict:
    jest.fn(),

  findOwnedProfilePhoto:
    jest.fn(),

  findActiveCountry:
    jest.fn(),

  findActiveCity:
    jest.fn(),

  updatePartial:
    jest.fn(),
};

const profileMapperMock = {
  toResponse:
    jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/users/repositories/index.js",
  () => ({
    profilesRepository:
      profilesRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/mappers/profile.mapper.js",
  () => ({
    default:
      profileMapperMock,
  }),
);

const { default: ProfileService } =
  await import(
    "../../../src/modules/users/services/profile.service.js"
  );

function createUpdateContext(
  overrides = {},
) {
  return {
    user_id: USER_ID,
    username: "current_user",
    display_name: "Current User",
    bio: "Current bio",
    profile_photo_asset_id: null,
    country_id: COUNTRY_ID,
    city_id: CITY_ID,
    is_private: false,
    ...overrides,
  };
}

describe("ProfileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    profilesRepositoryMock
      .findUpdateContext
      .mockResolvedValue(
        createUpdateContext(),
      );

    profilesRepositoryMock
      .findUsernameConflict
      .mockResolvedValue(null);

    profilesRepositoryMock
      .findOwnedProfilePhoto
      .mockResolvedValue({
        id: PHOTO_ID,
        uploaded_by: USER_ID,
        mime_type: "image/jpeg",
      });

    profilesRepositoryMock
      .findActiveCountry
      .mockResolvedValue({
        id: COUNTRY_ID,
        name: "India",
        code: "IN",
      });

    profilesRepositoryMock
      .findActiveCity
      .mockResolvedValue({
        id: CITY_ID,
        name: "Noida",
        country_id: COUNTRY_ID,
      });

    profilesRepositoryMock
      .updatePartial
      .mockResolvedValue({
        user_id: USER_ID,
      });

    profilesRepositoryMock
      .findByUserId
      .mockResolvedValue({
        user_id: USER_ID,
        username: "current_user",
        display_name: "Current User",
        bio: "Updated bio",
        country_id: COUNTRY_ID,
        city_id: CITY_ID,
        is_private: false,
      });

    profileMapperMock
      .toResponse
      .mockReturnValue({
        userId: USER_ID,
        username: "current_user",
        bio: "Updated bio",
      });
  });

  describe("updateMyProfile", () => {
    test(
      "updates only the supplied profile fields",
      async () => {
        const changes = {
          bio: "Updated bio",
          isPrivate: true,
        };

        const result =
          await ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes,
            });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalledWith({
          userId: USER_ID,
          changes,
        });

        expect(
          profilesRepositoryMock
            .findUsernameConflict,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .findOwnedProfilePhoto,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .findActiveCountry,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .findActiveCity,
        ).not.toHaveBeenCalled();

        expect(result).toEqual({
          userId: USER_ID,
          username: "current_user",
          bio: "Updated bio",
        });
      },
    );

    test(
      "rejects a username owned by another profile",
      async () => {
        profilesRepositoryMock
          .findUsernameConflict
          .mockResolvedValue({
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",
            username:
              "existing_user",
          });

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                username:
                  "existing_user",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "USER.USERNAME_ALREADY_EXISTS",
          statusCode: 409,
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an unavailable or unowned profile photo",
      async () => {
        profilesRepositoryMock
          .findOwnedProfilePhoto
          .mockResolvedValue(null);

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                profilePhotoAssetId:
                  PHOTO_ID,
              },
            }),
        ).rejects.toMatchObject({
          code:
            "PROFILE.PHOTO_NOT_ALLOWED",
          statusCode: 422,
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "allows the profile photo to be cleared",
      async () => {
        await ProfileService
          .updateMyProfile({
            userId: USER_ID,
            changes: {
              profilePhotoAssetId:
                null,
            },
          });

        expect(
          profilesRepositoryMock
            .findOwnedProfilePhoto,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalledWith({
          userId: USER_ID,
          changes: {
            profilePhotoAssetId:
              null,
          },
        });
      },
    );

    test(
      "rejects an inactive or missing country",
      async () => {
        profilesRepositoryMock
          .findActiveCountry
          .mockResolvedValue(null);

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                countryId:
                  OTHER_COUNTRY_ID,

                cityId: null,
              },
            }),
        ).rejects.toMatchObject({
          code:
            "PROFILE.COUNTRY_NOT_FOUND",
          statusCode: 422,
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an inactive or missing city",
      async () => {
        profilesRepositoryMock
          .findActiveCity
          .mockResolvedValue(null);

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                cityId:
                  CITY_ID,
              },
            }),
        ).rejects.toMatchObject({
          code:
            "PROFILE.CITY_NOT_FOUND",
          statusCode: 422,
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a city from a different country",
      async () => {
        profilesRepositoryMock
          .findActiveCountry
          .mockResolvedValue({
            id:
              OTHER_COUNTRY_ID,
          });

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                countryId:
                  OTHER_COUNTRY_ID,
              },
            }),
        ).rejects.toMatchObject({
          code:
            "PROFILE.CITY_COUNTRY_MISMATCH",
          statusCode: 422,
        });

        expect(
          profilesRepositoryMock
            .findActiveCity,
        ).toHaveBeenCalledWith(
          CITY_ID,
        );

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "accepts a matching country and city",
      async () => {
        await ProfileService
          .updateMyProfile({
            userId: USER_ID,
            changes: {
              countryId:
                COUNTRY_ID,

              cityId:
                CITY_ID,
            },
          });

        expect(
          profilesRepositoryMock
            .findActiveCountry,
        ).toHaveBeenCalledWith(
          COUNTRY_ID,
        );

        expect(
          profilesRepositoryMock
            .findActiveCity,
        ).toHaveBeenCalledWith(
          CITY_ID,
        );

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalled();
      },
    );

    test(
      "allows country and city to be cleared together",
      async () => {
        const changes = {
          countryId: null,
          cityId: null,
        };

        await ProfileService
          .updateMyProfile({
            userId: USER_ID,
            changes,
          });

        expect(
          profilesRepositoryMock
            .findActiveCountry,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .findActiveCity,
        ).not.toHaveBeenCalled();

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalledWith({
          userId: USER_ID,
          changes,
        });
      },
    );

    test(
      "maps a concurrent username conflict",
      async () => {
        profilesRepositoryMock
          .updatePartial
          .mockRejectedValue(
            Object.assign(
              new Error(
                "Unique violation",
              ),
              {
                code: "23505",
              },
            ),
          );

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                username:
                  "available_user",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "USER.USERNAME_ALREADY_EXISTS",
          statusCode: 409,
        });
      },
    );

    test(
      "maps a concurrent profile-photo foreign-key failure",
      async () => {
        profilesRepositoryMock
          .updatePartial
          .mockRejectedValue(
            Object.assign(
              new Error(
                "Foreign-key violation",
              ),
              {
                code: "23503",
                constraint:
                  "fk_profiles_profile_photo",
              },
            ),
          );

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                profilePhotoAssetId:
                  PHOTO_ID,
              },
            }),
        ).rejects.toMatchObject({
          code:
            "PROFILE.PHOTO_NOT_ALLOWED",
          statusCode: 422,
        });
      },
    );

    test(
      "does not write when the profile is missing",
      async () => {
        profilesRepositoryMock
          .findUpdateContext
          .mockResolvedValue(null);

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {
                bio: "New bio",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "USER.NOT_FOUND",
          statusCode: 404,
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).not.toHaveBeenCalled();
      },
    );
  });
});