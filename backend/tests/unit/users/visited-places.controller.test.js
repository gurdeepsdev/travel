import {
  jest,
} from "@jest/globals";

const submitVerificationMock =
  jest.fn();

const createdMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/users/services/visited-places.service.js",
  () => ({
    default: {
      submitVerification:
        submitVerificationMock,
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
  default: VisitedPlacesController,
} = await import(
  "../../../src/modules/users/controllers/visited-places.controller.js"
);

describe(
  "VisitedPlacesController submitVerification",
  () => {
    test(
      "forwards googlePlaceId and the verification photo",
      async () => {
        const verificationPhotoFile = {
          path:
            "/tmp/visit-photo.jpg",

          mimetype:
            "image/jpeg",
        };

        const logger = {
          error:
            jest.fn(),
        };

        const req = {
          user: {
            id:
              "63aae149-8f8f-4b30-b30d-211da764c080",
          },

          validated: {
            body: {
              googlePlaceId:
                "ChIJArticternVisitedPlaceTest",

              googleCityPlaceId:
                "ChIJdd4hrwug2EcRmSrV3Vo6llI",

              claimedVisitedAt:
                "2024-06-15T14:20:00.000Z",
            },
          },

          file:
            verificationPhotoFile,

          logger,
        };

        const res = {};
        const next = jest.fn();
        const result = {
          visitCreated:
            true,
        };

        submitVerificationMock
          .mockResolvedValue(
            result,
          );

        await VisitedPlacesController
          .submitVerification(
            req,
            res,
            next,
          );

        expect(
          submitVerificationMock,
        ).toHaveBeenCalledWith({
          userId:
            req.user.id,

          placeId:
            undefined,

          googlePlaceId:
            "ChIJArticternVisitedPlaceTest",

          googleCityPlaceId:
            "ChIJdd4hrwug2EcRmSrV3Vo6llI",

          claimedVisitedAt:
            "2024-06-15T14:20:00.000Z",

          verificationPhotoFile,
          logger,
        });

        expect(
          createdMock,
        ).toHaveBeenCalledWith(
          res,
          result,
          "Visited place verified successfully.",
        );

        expect(next)
          .not.toHaveBeenCalled();
      },
    );
  },
);
