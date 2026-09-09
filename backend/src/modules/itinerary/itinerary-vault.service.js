import Database from "../../database/database-manager.js";
import StorageManager from "../../providers/storage/storage-manager.js";
import MediaRepository from "../media/media.repository.js";
import MediaService from "../media/media.service.js";
import { buildAssetUrl } from "../users/utils/asset-url.util.js";
import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import { inspectVaultFile } from "./itinerary-vault-file.js";
import ItineraryVaultRepository from "./itinerary-vault.repository.js";

function mapDocument(document) {
  const assetPath = buildAssetUrl({
    assetId: document.asset_id,
    storageProvider: "local",
    storageKey: "private",
    isPublic: false,
  });
  const publicBaseUrl =
    process.env.API_PUBLIC_BASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  return {
    id: document.id,
    itineraryId:
      document.itinerary_id ?? null,
    tripId: document.trip_id,
    documentType:
      document.document_type,
    title: document.title,
    documentNumber:
      document.document_number,
    issueDate: document.issue_date,
    expiryDate: document.expiry_date,
    issuingCountryId:
      document.issuing_country_id,
    visibility: document.visibility,
    notes: document.notes,
    file: {
      assetId: document.asset_id,
      originalFilename:
        document.original_filename,
      mimeType: document.mime_type,
      extension: document.extension,
      fileSize: document.file_size,
      downloadUrl: document.itinerary_id
        ? `${publicBaseUrl ?? ""}/api/v1/itineraries/${document.itinerary_id}/vault/documents/${document.id}/download`
        : assetPath,
    },
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
}

class ItineraryVaultService {
  createTripRequiredError() {
    return new AppError({
      code:
        ErrorCodes.ITINERARY
          .TRIP_NOT_STARTED,
      message:
        "Move the itinerary to UPCOMING before using its digital vault.",
      statusCode: HttpStatus.CONFLICT,
    });
  }

  createNotFoundError() {
    return new AppError({
      code: ErrorCodes.ITINERARY.NOT_FOUND,
      message: "Itinerary not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  createDocumentNotFoundError() {
    return new AppError({
      code: ErrorCodes.ITINERARY.NOT_FOUND,
      message: "Vault document not found.",
      statusCode: HttpStatus.NOT_FOUND,
    });
  }

  async uploadDocument({
    itineraryId,
    userId,
    input,
    documentFile,
    logger = null,
  }) {
    const inspected =
      await inspectVaultFile(
        documentFile,
      );
    const stored = await StorageManager.store({
      temporaryPath:
        inspected.temporaryPath,
      category: "vault",
      userId,
      extension: inspected.extension,
    });
    const upload = {
      ...inspected,
      ...stored,
      fileIndex: 0,
    };

    try {
      const result =
        await Database.transaction(
          async (client) => {
            const itineraryTrip =
              await ItineraryVaultRepository
                .findOwnedItineraryTrip({
                  client,
                  itineraryId,
                  userId,
                });

            if (!itineraryTrip) {
              throw this
                .createNotFoundError();
            }

            if (!itineraryTrip.trip_id) {
              throw this
                .createTripRequiredError();
            }

            const resolution =
              await MediaRepository
                .resolveUploadedAssets({
                  client,
                  userId,
                  isPublic: false,
                  uploads: [upload],
                });
            const asset =
              resolution.assets[0];
            const document =
              await ItineraryVaultRepository
                .create({
                  client,
                  tripId:
                    itineraryTrip.trip_id,
                  userId,
                  assetId: asset.id,
                  input,
                });

            return {
              document: {
                ...document,
                itinerary_id: itineraryId,
                original_filename:
                  asset.original_filename,
                mime_type:
                  asset.mime_type,
                extension:
                  asset.extension,
                file_size:
                  asset.file_size,
              },
              unused:
                resolution
                  .unusedStoredObjects,
            };
          },
        );

      await Promise.allSettled(
        result.unused.map(
          ({ storageKey }) =>
            StorageManager.remove({
              storageKey,
            }),
        ),
      );

      return {
        document:
          mapDocument(
            result.document,
          ),
      };
    } catch (error) {
      await StorageManager.remove({
        storageKey: upload.storageKey,
      }).catch((cleanupError) => {
        logger?.error(
          { error: cleanupError },
          "Failed to clean vault document.",
        );
      });
      throw error;
    }
  }

  async listDocuments({
    itineraryId,
    userId,
    documentType = null,
  }) {
    const itineraryTrip =
      await ItineraryVaultRepository
        .findAccessibleItineraryTrip({
          itineraryId,
          userId,
        });
    if (!itineraryTrip) {
      throw this.createNotFoundError();
    }
    if (!itineraryTrip.trip_id) {
      throw this.createTripRequiredError();
    }

    const documents =
      await ItineraryVaultRepository
        .listAccessible({
          itineraryId,
          userId,
          documentType,
        });
    return {
      documents:
        documents.map(mapDocument),
    };
  }

  async deleteDocument({
    itineraryId,
    documentId,
    userId,
  }) {
    const deletedDocument =
      await ItineraryVaultRepository
        .deleteOwned({
          itineraryId,
          documentId,
          userId,
        });

    if (!deletedDocument) {
      throw this
        .createDocumentNotFoundError();
    }

    return {
      document: {
        id:
          deletedDocument.id,
        itineraryId:
          deletedDocument
            .itinerary_id,
        deletedAt:
          deletedDocument
            .deleted_at,
      },
    };
  }

  async downloadDocument({
    itineraryId,
    documentId,
    userId,
  }) {
    const document = await ItineraryVaultRepository
      .findAccessibleForDownload({ itineraryId, documentId, userId });
    if (!document) {
      throw this.createDocumentNotFoundError();
    }

    const content = await MediaService.getLocalAssetContent({
      assetId: document.asset_id,
      viewerUserId: userId,
    });
    return {
      filePath: content.filePath,
      filename: document.original_filename,
      mimeType: document.mime_type,
    };
  }

  async updateDocumentVisibility({
    itineraryId,
    documentId,
    userId,
    visibility,
  }) {
    if (visibility === "GROUP" && !await ItineraryVaultRepository
      .hasActiveLinkedGroup({ itineraryId })) {
      throw new AppError({
        code: ErrorCodes.ITINERARY.VAULT_GROUP_REQUIRED,
        message: "An active group linked to this itinerary is required.",
        statusCode: HttpStatus.CONFLICT,
      });
    }
    const document = await ItineraryVaultRepository.updateVisibilityOwned({
      itineraryId,
      documentId,
      userId,
      visibility,
    });
    if (!document) {
      throw this.createDocumentNotFoundError();
    }
    return {
      document: {
        id: document.id,
        itineraryId: document.itinerary_id,
        visibility: document.visibility,
        updatedAt: document.updated_at,
      },
    };
  }
}

export default new ItineraryVaultService();
