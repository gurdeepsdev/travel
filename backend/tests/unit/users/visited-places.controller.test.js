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
    beforeEach(() => {
      jest.clearAllMocks();
    });

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

    test(
      "returns the manual-review message for pending gallery evidence",
      async () => {
        const req = {
          user: {
            id:
              "63aae149-8f8f-4b30-b30d-211da764c080",
          },
          validated: {
            body: {
              placeId:
                "72bf8c7b-c684-4046-9f97-cfb1f569e59a",
              uploadSource:
                "GALLERY",
            },
          },
          file: {
            path:
              "/tmp/visit-photo.jpg",
          },
        };
        const res = {};
        const next = jest.fn();
        const result = {
          verification: {
            status:
              "PENDING",
          },
        };

        submitVerificationMock
          .mockResolvedValue(result);

        await VisitedPlacesController
          .submitVerification(
            req,
            res,
            next,
          );

        expect(createdMock)
          .toHaveBeenCalledWith(
            res,
            result,
            "Visit evidence submitted for manual review.",
          );
      },
    );
  },
);
