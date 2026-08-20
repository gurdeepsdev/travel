import {
  jest,
} from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const POST_ID =
  "d5000000-0000-4000-8000-000000000001";

const PLACE_ID =
  "72bf8c7b-c684-4046-9f97-cfb1f569e59a";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";

const GOOGLE_PLACE_ID =
  "ChIJLfySpTOuEmsRsc_JfJtljdc";

const GOOGLE_CITY_ID =
  "ChIJdd4hrwug2EcRmSrV3Vo6llI";

const ITINERARY_ID =
  "11111111-1111-4111-8111-111111111111";

const EXISTING_ASSET_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

const UPLOADED_ASSET_ID =
  "d6000000-0000-4000-8000-000000000001";

const TAGGED_USER_ID =
  "a4bfc312-1065-4377-adf7-98792cd212a3";

const databaseMock = {
  transaction:
    jest.fn(),
};

const storageManagerMock = {
  store:
    jest.fn(),

  remove:
    jest.fn(),

  name:
    "local",
};

const mediaRepositoryMock = {
  resolveUploadedAssets:
    jest.fn(),

  findOwnedPostAssets:
    jest.fn(),

  makeAssetsPublic:
    jest.fn(),
};

const userPostsRepositoryMock = {
  getPostsByIds:
    jest.fn(),
};

const postCreateRepositoryMock = {
  findEligiblePlace:
    jest.fn(),

  findEligibleGoogleLocation:
    jest.fn(),

  findOwnedItineraries:
    jest.fn(),

  findTaggableUsers:
    jest.fn(),

  insertPost:
    jest.fn(),

  insertPostAssets:
    jest.fn(),

  insertPostItineraries:
    jest.fn(),

  insertTaggedUsers:
    jest.fn(),
};

const inspectPostMediaFilesMock =
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
  "../../../src/modules/users/repositories/posts.repository.js",
  () => ({
    default:
      userPostsRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/repositories/post-create.repository.js",
  () => ({
    default:
      postCreateRepositoryMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/utils/post-media-file.util.js",
  () => ({
    inspectPostMediaFiles:
      inspectPostMediaFilesMock,
  }),
);

jest.unstable_mockModule(
  "../../../src/modules/posts/middleware/post-media-upload.middleware.js",
  () => ({
    MAX_POST_MEDIA_FILES: 10,
  }),
);

const {
  default:
    PostCreateService,
} = await import(
  "../../../src/modules/posts/services/post-create.service.js"
);

const transactionClient = {
  query:
    jest.fn(),
};

function createInspectedFile(
  overrides = {},
) {
  return {
    fileIndex: 0,

    temporaryPath:
      "/tmp/artictern-test-upload",

    originalFilename:
      "photo.png",

    mimeType:
      "image/png",

    extension:
      "png",

    fileSize:
      445,

    checksum:
      "a".repeat(64),

    mediaType:
      "IMAGE",

    ...overrides,
  };
}


function createUploadedAsset(
  overrides = {},
) {
  return {
    id:
      UPLOADED_ASSET_ID,

    fileIndex: 0,

    storage_provider:
      "local",

    bucket:
      "local",

    storage_key:
      "posts/user/photo.png",

    mime_type:
      "image/png",

    is_public:
      true,

    ...overrides,
  };
}

function createCanonicalPost(
  overrides = {},
) {
  return {
    id:
      POST_ID,

    caption:
      "My Noida trip",

    postType:
      "PLACE",

    visibility:
      "PUBLIC",

    assets: [],

    itineraries: [
      {
        id:
          ITINERARY_ID,
      },
    ],

    viewerState: {
      isOwner: true,
    },

    ...overrides,
  };
}

function createRequest(
  overrides = {},
) {
  return {
    userId:
      USER_ID,

    caption:
      "My Noida trip",

    visibility:
      "PUBLIC",

    placeId:
      PLACE_ID,

    existingAssetIds: [],

    mediaOrder: [],

    itineraryIds: [
      ITINERARY_ID,
    ],

    taggedUserIds: [],

    files: [],

    ...overrides,
  };
}

describe(
  "PostCreateService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      databaseMock
        .transaction
        .mockImplementation(
          async (
            callback,
          ) =>
            callback(
              transactionClient,
            ),
        );

      storageManagerMock
        .store
        .mockResolvedValue({
          storageProvider:
            "local",

          bucket:
            "local",

          storageKey:
            "posts/user/photo.png",
        });

      storageManagerMock
        .remove
        .mockResolvedValue(
          undefined,
        );

      inspectPostMediaFilesMock
        .mockResolvedValue([]);

      postCreateRepositoryMock
        .findEligiblePlace
        .mockResolvedValue({
          id:
            PLACE_ID,

          place_id:
            PLACE_ID,

          city_id:
            null,

          target_type:
            "PLACE",

          is_closed:
            false,
        });

      postCreateRepositoryMock
        .findEligibleGoogleLocation
        .mockResolvedValue({
          id:
            PLACE_ID,

          place_id:
            PLACE_ID,

          city_id:
            null,

          target_type:
            "PLACE",

          name:
            "DLF Mall of India",
        });

      mediaRepositoryMock
        .findOwnedPostAssets
        .mockResolvedValue([]);

      postCreateRepositoryMock
        .findOwnedItineraries
        .mockResolvedValue([
          {
            id:
              ITINERARY_ID,
          },
        ]);

      postCreateRepositoryMock
        .findTaggableUsers
        .mockResolvedValue([]);

      mediaRepositoryMock
        .resolveUploadedAssets
        .mockResolvedValue({
          assets: [],

          unusedStoredObjects: [],

          supersededStoredObjects: [],
        });

      mediaRepositoryMock
        .makeAssetsPublic
        .mockResolvedValue(
          undefined,
        );

      postCreateRepositoryMock
        .insertPost
        .mockResolvedValue({
          id:
            POST_ID,
        });

      postCreateRepositoryMock
        .insertPostAssets
        .mockResolvedValue([]);

      postCreateRepositoryMock
        .insertPostItineraries
        .mockResolvedValue([]);

      postCreateRepositoryMock
        .insertTaggedUsers
        .mockResolvedValue([]);

      userPostsRepositoryMock
        .getPostsByIds
        .mockResolvedValue([
          createCanonicalPost(),
        ]);
    });

    test(
      "creates an itinerary-only post and returns the canonical post",
      async () => {
        const result =
          await PostCreateService
            .createPost(
              createRequest(),
            );

        expect(
          databaseMock.transaction,
        ).toHaveBeenCalledTimes(1);

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          userId:
            USER_ID,

          caption:
            "My Noida trip",

          visibility:
            "PUBLIC",

          placeId:
            PLACE_ID,

          cityId:
            null,

          postType:
            "PLACE",
        });

        expect(
          postCreateRepositoryMock
            .insertPostItineraries,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          postId:
            POST_ID,

          itineraryIds: [
            ITINERARY_ID,
          ],
        });

        expect(
          userPostsRepositoryMock
            .getPostsByIds,
        ).toHaveBeenCalledWith({
          postIds: [
            POST_ID,
          ],

          viewerUserId:
            USER_ID,
        });

        expect(result).toEqual({
          post:
            createCanonicalPost(),
        });
      },
    );

    test(
      "creates a place post using one Google ID",
      async () => {
        const result =
          await PostCreateService
            .createPost(
              createRequest({
                placeId:
                  undefined,

                googleId:
                  GOOGLE_PLACE_ID,
              }),
            );

        expect(
          postCreateRepositoryMock
            .findEligibleGoogleLocation,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          googleId:
            GOOGLE_PLACE_ID,
        });

        expect(
          postCreateRepositoryMock
            .findEligiblePlace,
        ).not.toHaveBeenCalled();

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            placeId:
              PLACE_ID,

            cityId:
              null,

            postType:
              "PLACE",
          }),
        );

        expect(result).toEqual({
          post:
            createCanonicalPost(),
        });
      },
    );

    test(
      "creates a city post using one Google ID",
      async () => {
        postCreateRepositoryMock
          .findEligibleGoogleLocation
          .mockResolvedValue({
            id:
              CITY_ID,

            place_id:
              null,

            city_id:
              CITY_ID,

            target_type:
              "CITY",

            name:
              "Delhi",
          });

        await PostCreateService
          .createPost(
            createRequest({
              placeId:
                undefined,

              googleId:
                GOOGLE_CITY_ID,
            }),
          );

        expect(
          postCreateRepositoryMock
            .findEligibleGoogleLocation,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          googleId:
            GOOGLE_CITY_ID,
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            placeId:
              null,

            cityId:
              CITY_ID,

            postType:
              "CITY",
          }),
        );
      },
    );

    test(
      "rejects an unavailable Google Place ID",
      async () => {
        postCreateRepositoryMock
          .findEligibleGoogleLocation
          .mockResolvedValue(
            null,
          );

        await expect(
          PostCreateService
            .createPost(
              createRequest({
                placeId:
                  undefined,

                googleId:
                  GOOGLE_PLACE_ID,
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "POST.PLACE_NOT_ALLOWED",

          statusCode:
            404,
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a request with no media or itinerary before opening a transaction",
      async () => {
        await expect(
          PostCreateService
            .createPost(
              createRequest({
                itineraryIds: [],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "COMMON.VALIDATION_FAILED",

          statusCode: 400,
        });

        expect(
          databaseMock.transaction,
        ).not.toHaveBeenCalled();

        expect(
          storageManagerMock.store,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an unavailable place and removes newly stored files",
      async () => {
        inspectPostMediaFilesMock
          .mockResolvedValue([
            createInspectedFile(),
          ]);

        postCreateRepositoryMock
          .findEligiblePlace
          .mockResolvedValue(null);

        await expect(
          PostCreateService
            .createPost(
              createRequest({
                files: [
                  {
                    path:
                      "/tmp/artictern-test-upload",
                  },
                ],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "POST.PLACE_NOT_ALLOWED",

          statusCode: 404,
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            "posts/user/photo.png",
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects an unavailable existing asset",
      async () => {
        mediaRepositoryMock
          .findOwnedPostAssets
          .mockResolvedValue([]);

        await expect(
          PostCreateService
            .createPost(
              createRequest({
                existingAssetIds: [
                  EXISTING_ASSET_ID,
                ],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "POST.ASSET_NOT_ALLOWED",

          statusCode: 404,
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "requires explicit ordering when uploaded and existing media are combined",
      async () => {
        inspectPostMediaFilesMock
          .mockResolvedValue([
            createInspectedFile(),
          ]);

        mediaRepositoryMock
          .findOwnedPostAssets
          .mockResolvedValue([
            {
              id:
                EXISTING_ASSET_ID,
            },
          ]);

        mediaRepositoryMock
          .resolveUploadedAssets
          .mockResolvedValue({
            assets: [
              createUploadedAsset(),
            ],

            unusedStoredObjects: [],

            supersededStoredObjects: [],
          });

        await expect(
          PostCreateService
            .createPost(
              createRequest({
                files: [
                  {
                    path:
                      "/tmp/artictern-test-upload",
                  },
                ],

                existingAssetIds: [
                  EXISTING_ASSET_ID,
                ],

                mediaOrder: [],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "COMMON.VALIDATION_FAILED",

          statusCode: 400,
        });

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            "posts/user/photo.png",
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "creates uploaded and existing media in frontend order",
      async () => {
        inspectPostMediaFilesMock
          .mockResolvedValue([
            createInspectedFile(),
          ]);

        mediaRepositoryMock
          .findOwnedPostAssets
          .mockResolvedValue([
            {
              id:
                EXISTING_ASSET_ID,
            },
          ]);

        mediaRepositoryMock
          .resolveUploadedAssets
          .mockResolvedValue({
            assets: [
              createUploadedAsset(),
            ],

            unusedStoredObjects: [],

            supersededStoredObjects: [],
          });

        userPostsRepositoryMock
          .getPostsByIds
          .mockResolvedValue([
            createCanonicalPost({
              assets: [
                {
                  id:
                    UPLOADED_ASSET_ID,

                  displayOrder: 0,
                },
                {
                  id:
                    EXISTING_ASSET_ID,

                  displayOrder: 1,
                },
              ],
            }),
          ]);

        const result =
          await PostCreateService
            .createPost(
              createRequest({
                files: [
                  {
                    path:
                      "/tmp/artictern-test-upload",
                  },
                ],

                existingAssetIds: [
                  EXISTING_ASSET_ID,
                ],

                mediaOrder: [
                  {
                    source:
                      "UPLOAD",

                    fileIndex: 0,
                  },
                  {
                    source:
                      "EXISTING",

                    assetId:
                      EXISTING_ASSET_ID,
                  },
                ],
              }),
            );

        expect(
          postCreateRepositoryMock
            .insertPostAssets,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          postId:
            POST_ID,

          assetIds: [
            UPLOADED_ASSET_ID,
            EXISTING_ASSET_ID,
          ],
        });

        expect(
          mediaRepositoryMock
            .makeAssetsPublic,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          assetIds: [
            UPLOADED_ASSET_ID,
            EXISTING_ASSET_ID,
          ],
        });

        expect(
          result.post.assets,
        ).toHaveLength(2);
      },
    );

    test(
      "removes a redundant stored object after per-user deduplication",
      async () => {
        inspectPostMediaFilesMock
          .mockResolvedValue([
            createInspectedFile(),
          ]);

        mediaRepositoryMock
          .resolveUploadedAssets
          .mockResolvedValue({
            assets: [
              createUploadedAsset({
                id:
                  EXISTING_ASSET_ID,
              }),
            ],

            unusedStoredObjects: [
              {
                storageKey:
                  "posts/user/photo.png",
              },
            ],

            supersededStoredObjects: [],
          });

        await PostCreateService
          .createPost(
            createRequest({
              files: [
                {
                  path:
                    "/tmp/artictern-test-upload",
                },
              ],
            }),
          );

        expect(
          storageManagerMock.remove,
        ).toHaveBeenCalledWith({
          storageKey:
            "posts/user/photo.png",
        });

        expect(
          postCreateRepositoryMock
            .insertPostAssets,
        ).toHaveBeenCalledWith({
          client:
            transactionClient,

          postId:
            POST_ID,

          assetIds: [
            EXISTING_ASSET_ID,
          ],
        });
      },
    );

    test(
      "rejects tagging the author before inspecting or storing files",
      async () => {
        await expect(
          PostCreateService
            .createPost(
              createRequest({
                taggedUserIds: [
                  USER_ID,
                ],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "POST.TAGGED_USER_NOT_ALLOWED",

          statusCode: 400,
        });

        expect(
          inspectPostMediaFilesMock,
        ).not.toHaveBeenCalled();

        expect(
          databaseMock.transaction,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "rejects a blocked or unavailable tagged user",
      async () => {
        postCreateRepositoryMock
          .findTaggableUsers
          .mockResolvedValue([]);

        await expect(
          PostCreateService
            .createPost(
              createRequest({
                taggedUserIds: [
                  TAGGED_USER_ID,
                ],
              }),
            ),
        ).rejects.toMatchObject({
          code:
            "POST.TAGGED_USER_NOT_ALLOWED",

          statusCode: 404,
        });

        expect(
          postCreateRepositoryMock
            .insertPost,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
