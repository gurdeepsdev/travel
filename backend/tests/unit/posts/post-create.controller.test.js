import {
  jest,
} from "@jest/globals";

const USER_ID =
  "63aae149-8f8f-4b30-b30d-211da764c080";

const CITY_ID =
  "187cef7e-0554-42f0-a0b9-4e44b9824cee";


const createPostMock =
  jest.fn();

const createdMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/posts/services/post-create.service.js",
  () => ({
    default: {
      createPost:
        createPostMock,
    },
  }),
);

jest.unstable_mockModule(
  "../../../src/core/response/index.js",
  () => ({
    default: {
      created:
        createdMock,
    },
  }),
);

const {
  default: PostCreateController,
} = await import(
  "../../../src/modules/posts/controllers/post-create.controller.js"
);

describe(
  "PostCreateController createPost",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "forwards cityId to the service",
      async () => {
        const files = [
          {
            path:
              "/tmp/post.png",

            mimetype:
              "image/png",
          },
        ];

        const logger = {
          error:
            jest.fn(),
        };

        const req = {
          user: {
            id:
              USER_ID,
          },

          validated: {
            body: {
              caption:
                "City post",

              visibility:
                "PUBLIC",

              cityId:
                CITY_ID,

              existingAssetIds: [],

              mediaOrder: [],

              itineraryIds: [],

              taggedUserIds: [],
            },
          },

          files,
          logger,
        };

        const res = {};
        const next =
          jest.fn();

        const result = {
          post: {
            id:
              "d5000000-0000-4000-8000-000000000001",
          },
        };

        createPostMock
          .mockResolvedValue(
            result,
          );

        await PostCreateController
          .createPost(
            req,
            res,
            next,
          );

        expect(
          createPostMock,
        ).toHaveBeenCalledWith({
          userId:
            USER_ID,

          caption:
            "City post",

          visibility:
            "PUBLIC",

          cityId:
            CITY_ID,

          existingAssetIds: [],

          mediaOrder: [],

          itineraryIds: [],

          taggedUserIds: [],

          files,
          logger,
        });

        expect(
          createdMock,
        ).toHaveBeenCalledWith(
          res,
          result,
          "Post created successfully.",
        );

        expect(next)
          .not.toHaveBeenCalled();
      },
    );
  },
);
