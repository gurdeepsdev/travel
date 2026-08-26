import { jest } from "@jest/globals";

const repositoryMock = {
  findOwnedItineraryTrip: jest.fn(),
  listOwned: jest.fn(),
  create: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-vault.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-vault.service.js"
);

const itineraryId =
  "11111111-1111-4111-8111-111111111111";
const userId =
  "63aae149-8f8f-4b30-b30d-211da764c080";

describe("ItineraryVaultService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_PUBLIC_BASE_URL =
      "https://apitest.artictern.com";
  });

  test("lists only the owner's vault documents", async () => {
    repositoryMock.findOwnedItineraryTrip
      .mockResolvedValue({
        itinerary_id: itineraryId,
        trip_id:
          "22222222-2222-4222-8222-222222222222",
      });
    repositoryMock.listOwned
      .mockResolvedValue([
        {
          id:
            "33333333-3333-4333-8333-333333333333",
          trip_id:
            "22222222-2222-4222-8222-222222222222",
          asset_id:
            "44444444-4444-4444-8444-444444444444",
          document_type: "PASSPORT",
          title: "Passport",
          visibility: "PRIVATE",
          original_filename:
            "passport.pdf",
          mime_type:
            "application/pdf",
          extension: "pdf",
          file_size: 1000,
        },
      ]);

    const result = await service.listDocuments({
      itineraryId,
      userId,
      documentType: "PASSPORT",
    });

    expect(repositoryMock.listOwned)
      .toHaveBeenCalledWith({
        itineraryId,
        userId,
        documentType: "PASSPORT",
      });
    expect(result.documents[0])
      .toMatchObject({
        documentType: "PASSPORT",
        file: {
          downloadUrl:
            "https://apitest.artictern.com/api/v1/media/assets/44444444-4444-4444-8444-444444444444/content",
        },
      });
  });

  test("requires UPCOMING before vault access", async () => {
    repositoryMock.findOwnedItineraryTrip
      .mockResolvedValue({
        itinerary_id: itineraryId,
        trip_id: null,
      });

    await expect(
      service.listDocuments({
        itineraryId,
        userId,
      }),
    ).rejects.toMatchObject({
      code: "ITINERARY.TRIP_NOT_STARTED",
      statusCode: 409,
    });
  });

  test("hides missing and unowned itineraries", async () => {
    repositoryMock.findOwnedItineraryTrip
      .mockResolvedValue(null);

    await expect(
      service.listDocuments({
        itineraryId,
        userId,
      }),
    ).rejects.toMatchObject({
      code: "ITINERARY.NOT_FOUND",
      statusCode: 404,
    });
  });
});
