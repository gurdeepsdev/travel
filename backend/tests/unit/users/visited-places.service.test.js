import {
  jest,
} from "@jest/globals";



const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const PLACE_ID =
  "72bf8c7b-c684-4046-9f97-cfb1f569e59a";

const GOOGLE_PLACE_ID =
  "ChIJArticternVisitedPlaceTest";

const GOOGLE_CITY_PLACE_ID =
  "ChIJdd4hrwug2EcRmSrV3Vo6llI";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";

  const COLLECTION_ID =
  "ad786a5f-b5be-4ae7-b386-8dbadc01b865";

const ASSET_ID =
  "a2000000-0000-4000-8000-000000000001";

const CHECKSUM =
  "5b0cfd52dc0bfbe544f4e1a9c77aa46b8629b0e0aad6c54f95eef457b86c2a89";

const STORAGE_KEY =
  "visit-verifications/test/photo.jpg";

  const {
  decodeCursor,
} = await import(
  "../../../src/shared/utils/cursor.js"
);

  
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

const repositoryMock = {
  findVerificationContext:
    jest.fn(),

  findCityVerificationContext:
    jest.fn(),

  saveVerifiedVisit:
    jest.fn(),

  saveVerifiedCity:
    jest.fn(),

  updateCollectionPreference:
    jest.fn(),

    listVisitedPlaces:
    jest.fn(),
};

const mapperMock = {
  toVerificationResponse:
    jest.fn(),

  toCityVerificationResponse:
    jest.fn(),

  toPreferenceResponse:
    jest.fn(),

  toVisitedPlacesListResponse:
    jest.fn(),
};
const inspectEvidenceMock =
  jest.fn();

const extractMetadataMock =
  jest.fn();

const evaluateEvidenceMock =
  jest.fn();

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
  "../../../src/modules/users/repositories/visited-places.repository.js",
  () => ({
    default:
      repositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/mappers/visited-places.mapper.js",
  () => ({
    default:
      mapperMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/utils/visited-place-evidence-file.util.js",
  () => ({
    inspectVisitedPlaceEvidenceFile:
      inspectEvidenceMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/utils/visited-place-evidence-metadata.util.js",
  () => ({
    extractVisitedPlaceEvidenceMetadata:
      extractMetadataMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/users/utils/visited-place-verification.util.js",
  () => ({
    evaluateVisitedPlaceEvidence:
      evaluateEvidenceMock,
  }),
);

const {
  default: VisitedPlacesService,
} = await import(
  "../../../src/modules/users/services/visited-places.service.js"
);

function createContext(
  overrides = {},
) {
  return {
    place_id:
      PLACE_ID,

    place_name:
      "DLF Mall of India",

    place_latitude:
      28.5672,

    place_longitude:
      77.321,

    place_exists:
      true,

    place_available:
      true,

    city_id:
      CITY_ID,


    city_name:
      "Noida",

    existing_visit_id:
      null,

    existing_collection_id:
      null,

    duplicate_visit_id:
      null,

    ...overrides,
  };
}

function createVisit(
  overrides = {},
) {
  return {
    id:
      "a1000000-0000-4000-8000-000000000001",

    visit_created:
      true,

    place_id:
      PLACE_ID,

    city_id:
      CITY_ID,

    collection_id:
      "c1000000-0000-4000-8000-000000000001",

    verification_asset_id:
      ASSET_ID,

    verification_status:
      "VERIFIED",

    ...overrides,
  };
}

function createVisitedPlaceRow(
  overrides = {},
) {
  return {
    id:
      "46ae65d4-8b93-4135-900b-89fc98b49f51",

    user_id:
      USER_ID,

    place_id:
      PLACE_ID,

    place_name:
      "DLF Mall of India",

    city_id:
      CITY_ID,

    city_name:
      "Noida",

    collection_id:
      COLLECTION_ID,

    verification_status:
      "VERIFIED",

    collection_verified:
      true,

    visit_source:
      "PHOTO_VERIFICATION",

    visited_at:
      "2024-06-15T08:50:00.000Z",

    cursor_visited_at:
      "2024-06-15 08:50:00.000000+00",

    is_preference:
      false,

    icon_asset_id:
      null,

    ...overrides,
  };
}

function submit(
  overrides = {},
) {
  return VisitedPlacesService
    .submitVerification({
      userId:
        USER_ID,

      placeId:
        PLACE_ID,

      claimedVisitedAt:
        "2024-06-15T14:20:00.000Z",

      verificationPhotoFile: {
        path:
          "/tmp/visit-photo",

        originalname:
          "noida.jpg",

        mimetype:
          "image/jpeg",
      },

      ...overrides,
    });
}

describe(
  "VisitedPlacesService submitVerification",
  () => {
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

      inspectEvidenceMock
        .mockResolvedValue({
          temporaryPath:
            "/tmp/visit-photo",

          originalFilename:
            "noida.jpg",

          mimeType:
            "image/jpeg",

          extension:
            "jpg",

          fileSize:
            245000,

          checksum:
            CHECKSUM,
        });

      extractMetadataMock
        .mockResolvedValue({
          metadataRead:
            true,

          metadataPresent:
            true,

          hasGps:
            true,

          latitude:
            28.5672,

          longitude:
            77.321,

          hasCaptureTime:
            true,

          capturedAt:
            "2024-06-15T14:20:00.000Z",

          offsetTimeOriginal:
            "+05:30",

          camera: {
            make:
              "Test Camera",

            model:
              "Test Model",
          },

          software:
            null,
        });

      repositoryMock
        .findVerificationContext
        .mockResolvedValue(
          createContext(),
        );

      evaluateEvidenceMock
        .mockReturnValue({
          status:
            "VERIFIED",

          verified:
            true,

          reason:
            null,

          confidence:
            "MEDIUM",

          distanceMeters:
            0,

          radiusMeters:
            500,

          verificationMethod:
            "EXIF_GPS_AND_CAPTURE_TIME",
        });

      storageManagerMock
        .store
        .mockResolvedValue({
          storageProvider:
            "local",

          bucket:
            "local",

          storageKey:
            STORAGE_KEY,
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
                ASSET_ID,

              storage_provider:
                "local",

              storage_key:
                STORAGE_KEY,

              mime_type:
                "image/jpeg",

              is_public:
                true,
            },
          ],

          unusedStoredObjects:
            [],

          supersededStoredObjects:
            [],
        });

      repositoryMock
        .saveVerifiedVisit
        .mockResolvedValue(
          createVisit(),
        );

      repositoryMock
        .findCityVerificationContext
        .mockResolvedValue({
          city_id:
            CITY_ID,
          city_name:
            "Noida",
          city_latitude:
            28.5672,
          city_longitude:
            77.321,
          city_available:
            true,
          existing_collection_id:
            null,
          existing_collection_verified:
            false,
          duplicate_visit_id:
            null,
        });

      repositoryMock
        .saveVerifiedCity
        .mockResolvedValue({
          id:
            COLLECTION_ID,
          city_id:
            CITY_ID,
          city_name:
            "Noida",
          verification_asset_id:
            ASSET_ID,
          verification_status:
            true,
          visited_at:
            "2024-06-15T14:20:00.000Z",
          is_preference:
            false,
        });

      mapperMock
        .toVerificationResponse
        .mockReturnValue({
          visitCreated:
            true,
        });

      mapperMock
        .toCityVerificationResponse
        .mockReturnValue({
          visitCreated:
            true,
          visitedPlace:
            null,
        });
    });

    test(
      "rejects an unavailable place before permanent storage",
      async () => {
        repositoryMock
          .findVerificationContext
          .mockResolvedValue(
            createContext({
              place_available:
                false,
            }),
          );

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.PLACE_NOT_AVAILABLE",

          statusCode:
            404,
        });

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an already verified place",
      async () => {
        repositoryMock
          .findVerificationContext
          .mockResolvedValue(
            createContext({
              existing_visit_id:
                "existing-visit",
            }),
          );

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.EVIDENCE_REJECTED",

          statusCode:
            409,

          details: {
            reason:
              "PLACE_ALREADY_VERIFIED",
          },
        });

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an exact duplicate image before storage",
      async () => {
        repositoryMock
          .findVerificationContext
          .mockResolvedValue(
            createContext({
              duplicate_visit_id:
                "duplicate-visit",
            }),
          );

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.DUPLICATE_EVIDENCE",

          statusCode:
            409,
        });

        expect(
          evaluateEvidenceMock,
        ).not.toHaveBeenCalled();

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects insufficient historical evidence before storage",
      async () => {
        evaluateEvidenceMock
          .mockReturnValue({
            status:
              "REJECTED",

            verified:
              false,

            reason:
              "EXIF_GPS_REQUIRED",

            confidence:
              "NONE",

            distanceMeters:
              null,

            radiusMeters:
              500,
          });

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.EVIDENCE_REJECTED",

          statusCode:
            422,

          details: {
            reason:
              "EXIF_GPS_REQUIRED",

            distanceMeters:
              null,

            radiusMeters:
              500,
          },
        });

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "stores and saves verified historical evidence",
      async () => {
        const result =
          await submit();

        expect(
          storageManagerMock.store,
        ).toHaveBeenCalledWith({
          temporaryPath:
            "/tmp/visit-photo",

          category:
            "visit-verifications",

          userId:
            USER_ID,

          extension:
            "jpg",
        });

        expect(
          mediaRepositoryMock
            .resolveUploadedAssets,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            client:
              transactionClient,

            userId:
              USER_ID,

                   isPublic:
              false, 
          }),
        );

        expect(
          repositoryMock
            .saveVerifiedVisit,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            client:
              transactionClient,

            userId:
              USER_ID,

            placeId:
              PLACE_ID,

            verificationAssetId:
              ASSET_ID,

            evidenceCapturedAt:
              "2024-06-15T14:20:00.000Z",

            evidenceLatitude:
              28.5672,

            evidenceLongitude:
              77.321,

            evidenceSha256:
              CHECKSUM,

            visitedAt:
              "2024-06-15T14:20:00.000Z",
          }),
        );

        expect(
          mapperMock
            .toVerificationResponse,
        ).toHaveBeenCalled();

        expect(result)
          .toEqual({
            visitCreated:
              true,
          });
      },
    );

    test(
      "resolves a Google Place ID and saves the internal UUID",
      async () => {
        await submit({
          placeId:
            null,

          googlePlaceId:
            GOOGLE_PLACE_ID,

          googleCityPlaceId:
            GOOGLE_CITY_PLACE_ID,
        });

        expect(
          repositoryMock
            .findVerificationContext,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          placeId:
            null,

          googlePlaceId:
            GOOGLE_PLACE_ID,

          googleCityPlaceId:
            GOOGLE_CITY_PLACE_ID,

          evidenceSha256:
            CHECKSUM,
        });

        expect(
          repositoryMock
            .saveVerifiedVisit,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            userId:
              USER_ID,

            placeId:
              PLACE_ID,
          }),
        );
      },
    );

    test(
      "verifies a city using only its Google city Place ID",
      async () => {
        const result = await submit({
          placeId:
            null,
          googlePlaceId:
            null,
          googleCityPlaceId:
            GOOGLE_CITY_PLACE_ID,
        });

        expect(
          repositoryMock
            .findCityVerificationContext,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,
          googleCityPlaceId:
            GOOGLE_CITY_PLACE_ID,
          evidenceSha256:
            CHECKSUM,
        });

        expect(
          repositoryMock
            .findVerificationContext,
        ).not.toHaveBeenCalled();

        expect(
          repositoryMock
            .saveVerifiedCity,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,
          userId:
            USER_ID,
          cityId:
            CITY_ID,
          verificationAssetId:
            ASSET_ID,
          visitedAt:
            "2024-06-15T14:20:00.000Z",
        });

        expect(
          mapperMock
            .toCityVerificationResponse,
        ).toHaveBeenCalled();

        expect(result)
          .toEqual({
            visitCreated:
              true,
            visitedPlace:
              null,
          });
      },
    );

    test(
      "cleans stored evidence when the transaction fails",
      async () => {
        repositoryMock
          .saveVerifiedVisit
          .mockRejectedValue(
            new Error(
              "Database failed.",
            ),
          );

        await expect(
          submit(),
        ).rejects.toThrow(
          "Database failed.",
        );

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORAGE_KEY,
        });
      },
    );

    test(
      "maps a unique-constraint race to duplicate evidence",
      async () => {
        const databaseError =
          new Error(
            "Unique constraint failed.",
          );

        databaseError.code =
          "23505";

        repositoryMock
          .saveVerifiedVisit
          .mockRejectedValue(
            databaseError,
          );

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.DUPLICATE_EVIDENCE",

          statusCode:
            409,
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORAGE_KEY,
        });
      },
    );

    test(
      "rolls back a concurrent existing-visit result",
      async () => {
        repositoryMock
          .saveVerifiedVisit
          .mockResolvedValue(
            createVisit({
              visit_created:
                false,
            }),
          );

        await expect(
          submit(),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.EVIDENCE_REJECTED",

          statusCode:
            409,

          details: {
            reason:
              "PLACE_ALREADY_VERIFIED",
          },
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            STORAGE_KEY,
        });
      },
    );
  },


  
);

describe(
  "VisitedPlacesService updateCollectionPreference",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      repositoryMock
        .updateCollectionPreference
        .mockResolvedValue({
          id:
            COLLECTION_ID,

          user_id:
            USER_ID,

          city_id:
            CITY_ID,

          city_name:
            "Noida",

          verification_status:
            true,

          visited_at:
            "2024-06-15T08:50:00.000Z",

          is_preference:
            true,

          icon_asset_id:
            null,
        });

      mapperMock
        .toPreferenceResponse
        .mockReturnValue({
          collection: {
            id:
              COLLECTION_ID,

            isPreference:
              true,
          },
        });
    });

    test(
      "selects a verified city for profile display",
      async () => {
        const result =
          await VisitedPlacesService
            .updateCollectionPreference({
              userId:
                USER_ID,

              collectionId:
                COLLECTION_ID,

              isPreference:
                true,
            });

        expect(
          repositoryMock
            .updateCollectionPreference,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          collectionId:
            COLLECTION_ID,

          isPreference:
            true,
        });

        expect(
          mapperMock
            .toPreferenceResponse,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            id:
              COLLECTION_ID,

            is_preference:
              true,
          }),
        );

        expect(result)
          .toEqual({
            collection: {
              id:
                COLLECTION_ID,

              isPreference:
                true,
            },
          });
      },
    );

    test(
      "deselects a verified city from profile display",
      async () => {
        repositoryMock
          .updateCollectionPreference
          .mockResolvedValue({
            id:
              COLLECTION_ID,

            user_id:
              USER_ID,

            city_id:
              CITY_ID,

            verification_status:
              true,

            is_preference:
              false,
          });

        mapperMock
          .toPreferenceResponse
          .mockReturnValue({
            collection: {
              id:
                COLLECTION_ID,

              isPreference:
                false,
            },
          });

        const result =
          await VisitedPlacesService
            .updateCollectionPreference({
              userId:
                USER_ID,

              collectionId:
                COLLECTION_ID,

              isPreference:
                false,
            });

        expect(
          repositoryMock
            .updateCollectionPreference,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          collectionId:
            COLLECTION_ID,

          isPreference:
            false,
        });

        expect(result)
          .toEqual({
            collection: {
              id:
                COLLECTION_ID,

              isPreference:
                false,
            },
          });
      },
    );

    test(
      "hides a missing unauthorized or unverified collection",
      async () => {
        repositoryMock
          .updateCollectionPreference
          .mockResolvedValue(
            null,
          );

        await expect(
          VisitedPlacesService
            .updateCollectionPreference({
              userId:
                USER_ID,

              collectionId:
                COLLECTION_ID,

              isPreference:
                true,
            }),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.COLLECTION_NOT_FOUND",

          statusCode:
            404,
        });

        expect(
          mapperMock
            .toPreferenceResponse,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "maps the database preference limit to a conflict",
      async () => {
        const databaseError =
          new Error(
            "A maximum of five verified cities can be selected for profile display.",
          );

        databaseError.code =
          "23514";

        repositoryMock
          .updateCollectionPreference
          .mockRejectedValue(
            databaseError,
          );

        await expect(
          VisitedPlacesService
            .updateCollectionPreference({
              userId:
                USER_ID,

              collectionId:
                COLLECTION_ID,

              isPreference:
                true,
            }),
        ).rejects.toMatchObject({
          code:
            "VISITED_PLACE.PREFERENCE_LIMIT_REACHED",

          statusCode:
            409,

          details: {
            maximum:
              5,
          },
        });
      },
    );

    test(
      "does not hide unrelated database errors",
      async () => {
        const databaseError =
          new Error(
            "Another check constraint failed.",
          );

        databaseError.code =
          "23514";

        repositoryMock
          .updateCollectionPreference
          .mockRejectedValue(
            databaseError,
          );

        await expect(
          VisitedPlacesService
            .updateCollectionPreference({
              userId:
                USER_ID,

              collectionId:
                COLLECTION_ID,

              isPreference:
                true,
            }),
        ).rejects.toBe(
          databaseError,
        );
      },
    );
  },
);

describe(
  "VisitedPlacesService getMyVisitedPlaces",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "returns verified visited places",
      async () => {
        const row =
          createVisitedPlaceRow();

        repositoryMock
          .listVisitedPlaces
          .mockResolvedValue({
            rows: [
              row,
            ],

            hasMore:
              false,

            lastRow:
              row,
          });

        mapperMock
          .toVisitedPlacesListResponse
          .mockReturnValue({
            visitedPlaces: [
              {
                id:
                  row.id,

                place: {
                  id:
                    PLACE_ID,

                  name:
                    "DLF Mall of India",
                },
              },
            ],

            pagination: {
              hasMore:
                false,

              nextCursor:
                null,
            },
          });

        const result =
          await VisitedPlacesService
            .getMyVisitedPlaces({
              userId:
                USER_ID,

              limit:
                20,

              cursor:
                null,
            });

        expect(
          repositoryMock
            .listVisitedPlaces,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          limit:
            20,

          cursor:
            null,
        });

        expect(
          mapperMock
            .toVisitedPlacesListResponse,
        ).toHaveBeenCalledWith({
          rows: [
            row,
          ],

          hasMore:
            false,

          nextCursor:
            null,
        });

        expect(result)
          .toMatchObject({
            visitedPlaces: [
              {
                id:
                  row.id,

                place: {
                  id:
                    PLACE_ID,
                },
              },
            ],

            pagination: {
              hasMore:
                false,

              nextCursor:
                null,
            },
          });
      },
    );

    test(
      "creates a visited-at timestamp-safe cursor",
      async () => {
        const lastRow =
          createVisitedPlaceRow({
            id:
              "46ae65d4-8b93-4135-900b-89fc98b49f52",

            cursor_visited_at:
              "2024-06-15 08:50:00.654321+00",
          });

        repositoryMock
          .listVisitedPlaces
          .mockResolvedValue({
            rows: [
              createVisitedPlaceRow(),
            ],

            hasMore:
              true,

            lastRow,
          });

        mapperMock
          .toVisitedPlacesListResponse
          .mockImplementation(
            ({
              rows,
              hasMore,
              nextCursor,
            }) => ({
              visitedPlaces:
                rows,

              pagination: {
                hasMore,
                nextCursor,
              },
            }),
          );

        const result =
          await VisitedPlacesService
            .getMyVisitedPlaces({
              userId:
                USER_ID,

              limit:
                1,

              cursor:
                null,
            });

        expect(
          result.pagination.hasMore,
        ).toBe(true);

        expect(
          decodeCursor(
            result.pagination
              .nextCursor,
          ),
        ).toEqual({
          createdAt:
            "2024-06-15 08:50:00.654321+00",

          id:
            "46ae65d4-8b93-4135-900b-89fc98b49f52",
        });
      },
    );

    test(
      "returns an empty visited-place list",
      async () => {
        repositoryMock
          .listVisitedPlaces
          .mockResolvedValue({
            rows: [],

            hasMore:
              false,

            lastRow:
              null,
          });

        mapperMock
          .toVisitedPlacesListResponse
          .mockReturnValue({
            visitedPlaces: [],

            pagination: {
              hasMore:
                false,

              nextCursor:
                null,
            },
          });

        const result =
          await VisitedPlacesService
            .getMyVisitedPlaces({
              userId:
                USER_ID,

              limit:
                20,

              cursor:
                null,
            });

        expect(result)
          .toEqual({
            visitedPlaces: [],

            pagination: {
              hasMore:
                false,

              nextCursor:
                null,
            },
          });
      },
    );

    test(
      "rejects an invalid visited-place cursor before querying",
      async () => {
        await expect(
          VisitedPlacesService
            .getMyVisitedPlaces({
              userId:
                USER_ID,

              cursor:
                "invalid",
            }),
        ).rejects.toMatchObject({
          code:
            "COMMON.INVALID_CURSOR",

          statusCode:
            400,
        });

        expect(
          repositoryMock
            .listVisitedPlaces,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
