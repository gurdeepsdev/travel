import {
  jest,
} from "@jest/globals";

const submitVerificationMock =
  jest.fn();

const getVerificationMock =
  jest.fn();

const getVerificationsMock =
  jest.fn();

const createdMock =
  jest.fn();

const successMock =
  jest.fn();

jest.unstable_mockModule(
  "../../../src/modules/users/services/visited-places.service.js",
  () => ({
    default: {
      submitVerification:
        submitVerificationMock,

      getVerification:
        getVerificationMock,

      getVerifications:
        getVerificationsMock,
    },
  }),
);

jest.unstable_mockModule(
  "../../../src/core/response/index.js",
  () => ({
    default: {
      created:
        createdMock,

      success:
        successMock,
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

describe(
  "VisitedPlacesController getVerifications",
  () => {
    test(
      "returns the authenticated verification list",
      async () => {
        const req = {
          user: {
            id:
              "63aae149-8f8f-4b30-b30d-211da764c080",
          },
          validated: {
            query: {
              limit: 20,
            },
          },
        };
        const res = {};
        const next = jest.fn();
        const result = {
          verifications: [],
          pagination: {
            hasMore: false,
            nextCursor: null,
          },
        };

        getVerificationsMock
          .mockResolvedValue(result);

        await VisitedPlacesController
          .getVerifications(
            req,
            res,
            next,
          );

        expect(getVerificationsMock)
          .toHaveBeenCalledWith({
            userId: req.user.id,
            limit: 20,
            cursor: null,
          });
        expect(successMock)
          .toHaveBeenCalledWith(
            res,
            result,
            "Visit verifications fetched successfully.",
          );
      },
    );
  },
);

describe(
  "VisitedPlacesController getVerification",
  () => {
    test(
      "returns one owned verification",
      async () => {
        const verificationId =
          "b1000000-0000-4000-8000-000000000001";
        const req = {
          user: {
            id:
              "63aae149-8f8f-4b30-b30d-211da764c080",
          },
          validated: {
            params: {
              verificationId,
            },
          },
        };
        const res = {};
        const next = jest.fn();
        const result = {
          verification: {
            id:
              verificationId,
          },
        };

        getVerificationMock
          .mockResolvedValue(result);

        await VisitedPlacesController
          .getVerification(
            req,
            res,
            next,
          );

        expect(successMock)
          .toHaveBeenCalledWith(
            res,
            result,
            "Visit verification fetched successfully.",
          );
      },
    );
  },
);
