import { jest } from "@jest/globals";
const fsPromises = await import('node:fs/promises');
const accessMock = jest.fn();
jest.unstable_mockModule('node:fs/promises', () => ({...fsPromises,access:accessMock}));

const repositoryMock = {
  findOwnedItineraryTrip: jest.fn(),
  findAccessibleItineraryTrip: jest.fn(),
  listOwned: jest.fn(),
  listAccessible: jest.fn(),
  create: jest.fn(),
  deleteOwned: jest.fn(),
  findOwnedForDownload: jest.fn(),
  findAccessibleForDownload: jest.fn(),
  updateVisibilityOwned: jest.fn(),
  hasActiveLinkedGroup: jest.fn(),
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
const documentId =
  "33333333-3333-4333-8333-333333333333";

describe("ItineraryVaultService", () => {
  test('returns 503 for missing authorized file content', async () => {
    repositoryMock.findAccessibleForDownload.mockResolvedValue({storage_provider:'local',storage_key:'vault/missing.pdf'});
    accessMock.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(service.downloadDocument({itineraryId,documentId,userId})).rejects.toMatchObject({statusCode:503});
  });
  test('rejects unsupported storage without reading a file', async () => {
    repositoryMock.findAccessibleForDownload.mockResolvedValue({storage_provider:'unknown'});
    await expect(service.downloadDocument({itineraryId,documentId,userId})).rejects.toMatchObject({statusCode:404});
    expect(accessMock).not.toHaveBeenCalled();
  });
  test('rejects visibility changes for another document owner', async () => {
    repositoryMock.updateVisibilityOwned.mockResolvedValue(null);
    await expect(service.updateDocumentVisibility({itineraryId,documentId,userId,visibility:'GROUP'}))
      .rejects.toMatchObject({statusCode:404});
  });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_PUBLIC_BASE_URL =
      "https://apitest.artictern.com";
  });

  test("lists only the owner's vault documents", async () => {
    repositoryMock.findAccessibleItineraryTrip
      .mockResolvedValue({
        itinerary_id: itineraryId,
        trip_id:
          "22222222-2222-4222-8222-222222222222",
      });
    repositoryMock.listAccessible
      .mockResolvedValue([
        {
          id:
            "33333333-3333-4333-8333-333333333333",
          trip_id:
            "22222222-2222-4222-8222-222222222222",
          itinerary_id: itineraryId,
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

    expect(repositoryMock.listAccessible)
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
            `https://apitest.artictern.com/api/v1/itineraries/${itineraryId}/vault/documents/33333333-3333-4333-8333-333333333333/download`,
        },
      });
  });

  test("requires UPCOMING before vault access", async () => {
    repositoryMock.findAccessibleItineraryTrip
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
    repositoryMock.findAccessibleItineraryTrip
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

  test("soft-deletes an owned vault document", async () => {
    repositoryMock.deleteOwned
      .mockResolvedValue({
        id: documentId,
        itinerary_id: itineraryId,
        deleted_at:
          "2026-09-01T10:00:00.000Z",
      });

    const result =
      await service.deleteDocument({
        itineraryId,
        documentId,
        userId,
      });

    expect(repositoryMock.deleteOwned)
      .toHaveBeenCalledWith({
        itineraryId,
        documentId,
        userId,
      });
    expect(result).toEqual({
      document: {
        id: documentId,
        itineraryId,
        deletedAt:
          "2026-09-01T10:00:00.000Z",
      },
    });
  });

  test("hides missing or unowned vault documents", async () => {
    repositoryMock.deleteOwned
      .mockResolvedValue(null);

    await expect(
      service.deleteDocument({
        itineraryId,
        documentId,
        userId,
      }),
    ).rejects.toMatchObject({
      code: "ITINERARY.NOT_FOUND",
      statusCode: 404,
    });
  });

  test("returns an owned vault document for attachment download", async () => {
    repositoryMock.findAccessibleForDownload.mockResolvedValue({
      id: documentId,
      asset_id: "44444444-4444-4444-8444-444444444444",
      original_filename: "passport.pdf",
      mime_type: "application/pdf",
      storage_provider: 'local', storage_key: 'vault/passport.pdf',
    });
    accessMock.mockResolvedValue(undefined);

    await expect(service.downloadDocument({ itineraryId, documentId, userId }))
      .resolves.toEqual({
        filePath: expect.stringContaining('/vault/passport.pdf'),
        filename: "passport.pdf",
        mimeType: "application/pdf",
      });
    expect(accessMock).toHaveBeenCalled();
  });

  test("hides an unowned vault document download", async () => {
    repositoryMock.findAccessibleForDownload.mockResolvedValue(null);
    await expect(service.downloadDocument({ itineraryId, documentId, userId }))
      .rejects.toMatchObject({ code: "ITINERARY.NOT_FOUND", statusCode: 404 });
  });

  test("lets the owner share a document with the linked group", async () => {
    repositoryMock.hasActiveLinkedGroup.mockResolvedValue(true);
    repositoryMock.updateVisibilityOwned.mockResolvedValue({
      id: documentId,
      itinerary_id: itineraryId,
      visibility: "GROUP",
      updated_at: "2026-09-09T12:00:00.000Z",
    });
    await expect(service.updateDocumentVisibility({ itineraryId, documentId,
      userId, visibility: "GROUP" })).resolves.toEqual({
      document: { id: documentId, itineraryId, visibility: "GROUP",
        updatedAt: "2026-09-09T12:00:00.000Z" },
    });
  });

  test("requires an active linked group before sharing", async () => {
    repositoryMock.updateVisibilityOwned.mockResolvedValue({groupRequired:true});
    repositoryMock.hasActiveLinkedGroup.mockResolvedValue(false);
    await expect(service.updateDocumentVisibility({ itineraryId, documentId,
      userId, visibility: "GROUP" })).rejects.toMatchObject({
      code: "ITINERARY.VAULT_GROUP_REQUIRED", statusCode: 409,
    });
  });

  test("lets the owner restore group visibility to private", async () => {
    repositoryMock.updateVisibilityOwned.mockResolvedValue({
      id: documentId, itinerary_id: itineraryId, visibility: "PRIVATE",
      updated_at: "2026-09-09T12:01:00.000Z",
    });
    const result = await service.updateDocumentVisibility({ itineraryId, documentId,
      userId, visibility: "PRIVATE" });
    expect(repositoryMock.hasActiveLinkedGroup).not.toHaveBeenCalled();
    expect(result.document.visibility).toBe("PRIVATE");
  });
});
