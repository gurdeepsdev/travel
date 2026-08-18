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

  const UPLOADED_PHOTO_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const STORED_PHOTO_KEY =
  "profile-photos/63aae149-8f8f-4b30-b30d-211da764c080/2026/08/upload.png";

const transactionClient = {
  query:
    jest.fn(),
};

const databaseMock = {
  transaction:
    jest.fn(),
};

const storageManagerMock = {
  store:
    jest.fn(),

  remove:
    jest.fn(),
};

const mediaRepositoryMock = {
  resolveUploadedAssets:
    jest.fn(),
};

const inspectProfilePhotoFileMock =
  jest.fn();

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
  "../../../src/database/database-manager.js",
  () => ({
    default:
      databaseMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/providers/storage/storage-manager.js",
  () => ({
    default:
      storageManagerMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/media/media.repository.js",
  () => ({
    default:
      mediaRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/utils/profile-photo-file.util.js",
  () => ({
    inspectProfilePhotoFile:
      inspectProfilePhotoFileMock,
  }),
);

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

databaseMock
      .transaction
      .mockImplementation(
        async (callback) =>
          callback(
            transactionClient,
          ),
      );

    inspectProfilePhotoFileMock
      .mockResolvedValue({
        temporaryPath:
          "/tmp/profile-photo",

        originalFilename:
          "profile.png",

        mimeType:
          "image/png",

        extension:
          "png",

        fileSize: 445,

        checksum:
          "5b0cfd52dc0bfbe544f4e1a9c77aa46b8629b0e0aad6c54f95eef457b86c2a89",
      });

    storageManagerMock
      .store
      .mockResolvedValue({
        storageProvider:
          "local",

        bucket:
          "local",

        storageKey:
          STORED_PHOTO_KEY,
      });

    storageManagerMock
      .remove
      .mockResolvedValue();

    mediaRepositoryMock
      .resolveUploadedAssets
      .mockResolvedValue({
        assets: [
          {
            id:
              UPLOADED_PHOTO_ID,

            storage_provider:
              "local",

            storage_key:
              STORED_PHOTO_KEY,

            is_public: true,

            fileIndex: 0,
          },
        ],

        unusedStoredObjects: [],

        supersededStoredObjects: [],
      });

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
      "rejects an empty update without an uploaded photo",
      async () => {
        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {},
            }),
        ).rejects.toMatchObject({
          code:
            "COMMON.VALIDATION_FAILED",

          statusCode: 400,
        });

        expect(
          profilesRepositoryMock
            .findUpdateContext,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects upload and profilePhotoAssetId together",
      async () => {
        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,

              changes: {
                profilePhotoAssetId:
                  PHOTO_ID,
              },

              profilePhotoFile: {
                path:
                  "/tmp/profile-photo",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "COMMON.VALIDATION_FAILED",

          statusCode: 400,
        });

        expect(
          inspectProfilePhotoFileMock,
        ).not.toHaveBeenCalled();

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "stores an uploaded photo and updates the profile transactionally",
      async () => {
        const profilePhotoFile = {
          path:
            "/tmp/profile-photo",

          originalname:
            "profile.png",

          mimetype:
            "image/png",
        };

        const result =
          await ProfileService
            .updateMyProfile({
              userId: USER_ID,

              changes: {
                bio:
                  "Updated with photo",
              },

              profilePhotoFile,
            });

        expect(
          inspectProfilePhotoFileMock,
        ).toHaveBeenCalledWith(
          profilePhotoFile,
        );

        expect(
          storageManagerMock.store,
        ).toHaveBeenCalledWith({
          temporaryPath:
            "/tmp/profile-photo",

          category:
            "profile-photos",

          userId:
            USER_ID,

          extension:
            "png",
        });

        expect(
          databaseMock.transaction,
        ).toHaveBeenCalledTimes(1);

        expect(
          mediaRepositoryMock
            .resolveUploadedAssets,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          userId:
            USER_ID,

          isPublic: true,

          uploads: [
            expect.objectContaining({
              storageKey:
                STORED_PHOTO_KEY,

              checksum:
                "5b0cfd52dc0bfbe544f4e1a9c77aa46b8629b0e0aad6c54f95eef457b86c2a89",

              fileIndex: 0,
            }),
          ],
        });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          changes: {
            bio:
              "Updated with photo",

            profilePhotoAssetId:
              UPLOADED_PHOTO_ID,
          },

          client:
            transactionClient,
        });

        expect(
          storageManagerMock.remove,
        ).not.toHaveBeenCalled();

        expect(result).toEqual({
          userId: USER_ID,
          username: "current_user",
          bio: "Updated bio",
        });
      },
    );

    test(
      "removes a redundant object after checksum deduplication",
      async () => {
        mediaRepositoryMock
          .resolveUploadedAssets
          .mockResolvedValue({
            assets: [
              {
                id:
                  PHOTO_ID,

                storage_provider:
                  "local",

                storage_key:
                  "profile-photos/existing.png",

                is_public: true,

                fileIndex: 0,
              },
            ],

            unusedStoredObjects: [
              {
                storageKey:
                  STORED_PHOTO_KEY,
              },
            ],

            supersededStoredObjects: [],
          });

        await ProfileService
          .updateMyProfile({
            userId: USER_ID,
            changes: {},

            profilePhotoFile: {
              path:
                "/tmp/profile-photo",
            },
          });

        expect(
          profilesRepositoryMock
            .updatePartial,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          changes: {
            profilePhotoAssetId:
              PHOTO_ID,
          },

          client:
            transactionClient,
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORED_PHOTO_KEY,
        });
      },
    );

    test(
      "removes the stored object when the transaction fails",
      async () => {
        databaseMock
          .transaction
          .mockRejectedValue(
            new Error(
              "Transaction failed",
            ),
          );

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {},

              profilePhotoFile: {
                path:
                  "/tmp/profile-photo",
              },
            }),
        ).rejects.toThrow(
          "Transaction failed",
        );

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORED_PHOTO_KEY,
        });
      },
    );

    test(
      "does not inspect or store a photo when the profile is missing",
      async () => {
        profilesRepositoryMock
          .findUpdateContext
          .mockResolvedValue(null);

        await expect(
          ProfileService
            .updateMyProfile({
              userId: USER_ID,
              changes: {},

              profilePhotoFile: {
                path:
                  "/tmp/profile-photo",
              },
            }),
        ).rejects.toMatchObject({
          code:
            "USER.NOT_FOUND",

          statusCode: 404,
        });

        expect(
          inspectProfilePhotoFileMock,
        ).not.toHaveBeenCalled();

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );


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