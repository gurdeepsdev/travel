import Database
  from "../../../database/database-manager.js";

import StorageManager
  from "../../../providers/storage/storage-manager.js";

import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

import MediaRepository
  from "../../media/media.repository.js";

import VisitedPlacesMapper
  from "../mappers/visited-places.mapper.js";

import VisitedPlacesRepository
  from "../repositories/visited-places.repository.js";

import {
  inspectVisitedPlaceEvidenceFile,
} from "../utils/visited-place-evidence-file.util.js";

import {
  extractVisitedPlaceEvidenceMetadata,
} from "../utils/visited-place-evidence-metadata.util.js";

import {
  evaluateVisitedPlaceEvidence,
} from "../utils/visited-place-verification.util.js";

import {
  decodeCursor,
  encodeCursor,
} from "../../../shared/utils/cursor.js";

function uniqueStorageObjects(
  objects,
) {
  const storageKeys =
    new Set();

  return (objects ?? [])
    .filter((object) => {
      const storageKey =
        object?.storageKey;

      if (
        !storageKey ||
        storageKeys.has(
          storageKey,
        )
      ) {
        return false;
      }

      storageKeys.add(
        storageKey,
      );

      return true;
    });
}

async function cleanupStorageObjects({
  objects,
  logger,
  logMessage,
}) {
  const uniqueObjects =
    uniqueStorageObjects(
      objects,
    );

  const results =
    await Promise.allSettled(
      uniqueObjects.map(
        (object) =>
          StorageManager.remove({
            storageKey:
              object.storageKey,
          }),
      ),
    );

  results.forEach(
    (
      result,
      index,
    ) => {
      if (
        result.status ===
          "rejected"
      ) {
        logger?.error(
          {
            storageKey:
              uniqueObjects[index]
                .storageKey,

            error: {
              name:
                result.reason?.name,

              message:
                result.reason
                  ?.message,

              stack:
                result.reason?.stack,
            },
          },
          logMessage,
        );
      }
    },
  );
}

function createPlaceNotAvailableError() {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .PLACE_NOT_AVAILABLE,

    message:
      "Place is not available for visit verification.",

    statusCode:
      HttpStatus.NOT_FOUND,

    details:
      null,
  });
}

function createDuplicateEvidenceError() {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .DUPLICATE_EVIDENCE,

    message:
      "This image has already been used as visit evidence.",

    statusCode:
      HttpStatus.CONFLICT,

    details:
      null,
  });
}

function createRejectedEvidenceError(
  decision,
) {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .EVIDENCE_REJECTED,

    message:
      "Visit evidence could not be verified.",

    statusCode:
      HttpStatus
        .UNPROCESSABLE_ENTITY,

    details: {
      reason:
        decision.reason,

      distanceMeters:
        decision.distanceMeters ??
        null,

      radiusMeters:
        decision.radiusMeters ??
        null,
    },
  });
}


function createCollectionNotFoundError() {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .COLLECTION_NOT_FOUND,

    message:
      "Verified city collection not found.",

    statusCode:
      HttpStatus.NOT_FOUND,

    details:
      null,
  });
}

function createPreferenceLimitError() {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .PREFERENCE_LIMIT_REACHED,

    message:
      "A maximum of five verified cities can be selected for profile display.",

    statusCode:
      HttpStatus.CONFLICT,

    details: {
      maximum:
        5,
    },
  });
}

function isPreferenceLimitError(
  error,
) {
  return (
    error?.code === "23514" &&
    error?.message ===
      "A maximum of five verified cities can be selected for profile display."
  );
}
class VisitedPlacesService {
  async submitVerification({
    userId,
    placeId = null,
    googlePlaceId = null,
    googleCityPlaceId = null,
    claimedVisitedAt = null,
    verificationPhotoFile,
    logger = null,
  }) {
    let inspectedEvidence;

    try {
      inspectedEvidence =
        await inspectVisitedPlaceEvidenceFile(
          verificationPhotoFile,
        );
    } catch (error) {
      if (
        error instanceof AppError
      ) {
        throw error;
      }

      throw new AppError({
        code:
          ErrorCodes
            .VISITED_PLACE
            .EVIDENCE_UPLOAD_FAILED,

        message:
          "Visit evidence image could not be inspected.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details:
          null,

        cause:
          error,
      });
    }

    const metadata =
      await extractVisitedPlaceEvidenceMetadata(
        inspectedEvidence.temporaryPath,
      );

    const context =
      await VisitedPlacesRepository
        .findVerificationContext({
          userId,
          placeId,
          googlePlaceId,
          googleCityPlaceId,

          evidenceSha256:
            inspectedEvidence.checksum,
        });

    if (
      !context ||
      context.place_available !==
        true
    ) {
      throw createPlaceNotAvailableError();
    }

    if (
      context.existing_visit_id
    ) {
      throw new AppError({
        code:
          ErrorCodes
            .VISITED_PLACE
            .EVIDENCE_REJECTED,

        message:
          "This place is already verified for the user.",

        statusCode:
          HttpStatus.CONFLICT,

        details: {
          reason:
            "PLACE_ALREADY_VERIFIED",
        },
      });
    }

    if (
      context.duplicate_visit_id
    ) {
      throw createDuplicateEvidenceError();
    }

    const decision =
      evaluateVisitedPlaceEvidence({
        metadata,

        place: {
          latitude:
            context.place_latitude,

          longitude:
            context.place_longitude,
        },
      });

    if (
      decision.verified !==
        true
    ) {
      throw createRejectedEvidenceError(
        decision,
      );
    }

    let storedEvidence;

    try {
      const stored =
        await StorageManager.store({
          temporaryPath:
            inspectedEvidence
              .temporaryPath,

          category:
            "visit-verifications",

          userId,

          extension:
            inspectedEvidence.extension,
        });

      storedEvidence = {
        ...inspectedEvidence,
        ...stored,

        fileIndex:
          0,
      };
    } catch (error) {
      throw new AppError({
        code:
          ErrorCodes
            .VISITED_PLACE
            .EVIDENCE_UPLOAD_FAILED,

        message:
          "Visit evidence image could not be stored.",

        statusCode:
          HttpStatus
            .INTERNAL_SERVER_ERROR,

        details:
          null,

        cause:
          error,
      });
    }

    let transactionResult;

    try {
      transactionResult =
        await Database.transaction(
          async (client) => {
            const resolved =
              await MediaRepository
                .resolveUploadedAssets({
                  client,
                  userId,

                                  /*
                   * Verification evidence belongs to
                   * the user and is not a public city
                   * icon. City icons come from
                   * poi.cities.icon_asset_id.
                   */
                  isPublic:
                    false,

                  uploads: [
                    storedEvidence,
                  ],
                });

            const evidenceAsset =
              resolved.assets[0] ??
              null;

            if (!evidenceAsset) {
              throw new AppError({
                code:
                  ErrorCodes
                    .VISITED_PLACE
                    .EVIDENCE_UPLOAD_FAILED,

                message:
                  "Visit evidence asset could not be created.",

                statusCode:
                  HttpStatus
                    .INTERNAL_SERVER_ERROR,

                details:
                  null,
              });
            }

            const verificationDetails = {
              confidence:
                decision.confidence,

              verificationMethod:
                decision
                  .verificationMethod,

              distanceMeters:
                decision.distanceMeters,

              radiusMeters:
                decision.radiusMeters,

              metadataPresent:
                metadata.metadataPresent,

              offsetTimeOriginal:
                metadata
                  .offsetTimeOriginal,

              camera:
                metadata.camera,

              software:
                metadata.software,
            };

            const visit =
              await VisitedPlacesRepository
                .saveVerifiedVisit({
                  client,
                  userId,
                  placeId:
                    context.place_id,

                  verificationAssetId:
                    evidenceAsset.id,

                  claimedVisitedAt,

                  evidenceCapturedAt:
                    metadata.capturedAt,

                  evidenceLatitude:
                    metadata.latitude,

                  evidenceLongitude:
                    metadata.longitude,

                  evidenceSha256:
                    inspectedEvidence
                      .checksum,

                  evidencePerceptualHash:
                    null,

                  visitedAt:
                    metadata.capturedAt,

                  verificationDetails,
                });

            if (!visit) {
              throw createPlaceNotAvailableError();
            }

            /*
             * A concurrent request may have created the
             * same visit after the initial context read.
             * Roll back this transaction and its asset.
             */
            if (
              visit.visit_created !==
                true
            ) {
              throw new AppError({
                code:
                  ErrorCodes
                    .VISITED_PLACE
                    .EVIDENCE_REJECTED,

                message:
                  "This place is already verified for the user.",

                statusCode:
                  HttpStatus.CONFLICT,

                details: {
                  reason:
                    "PLACE_ALREADY_VERIFIED",
                },
              });
            }

            return {
              visit,
              evidenceAsset,

              cleanupObjects: [
                ...resolved
                  .unusedStoredObjects,

                ...resolved
                  .supersededStoredObjects,
              ],
            };
          },
        );
    } catch (error) {
      await cleanupStorageObjects({
        objects: [
          storedEvidence,
        ],

        logger,

        logMessage:
          "Failed to clean visit evidence after transaction failure.",
      });

      if (
        error?.code === "23505"
      ) {
        throw createDuplicateEvidenceError();
      }

      throw error;
    }

    await cleanupStorageObjects({
      objects:
        transactionResult
          .cleanupObjects,

      logger,

      logMessage:
        "Failed to clean unused visit evidence storage object.",
    });

    return VisitedPlacesMapper
      .toVerificationResponse({
        row:
          transactionResult.visit,

        asset:
          transactionResult
            .evidenceAsset,
      });
  }


    async updateCollectionPreference({
    userId,
    collectionId,
    isPreference,
  }) {
    let collection;

    try {
      collection =
        await VisitedPlacesRepository
          .updateCollectionPreference({
            userId,
            collectionId,
            isPreference,
          });
    } catch (error) {
      if (
        isPreferenceLimitError(
          error,
        )
      ) {
        throw createPreferenceLimitError();
      }

      throw error;
    }

    /*
     * Hide whether the collection is missing,
     * belongs to another user, or is unverified.
     */
    if (!collection) {
      throw createCollectionNotFoundError();
    }

    return VisitedPlacesMapper
      .toPreferenceResponse(
        collection,
      );
  }


    /**
   * Returns verified places visited by the
   * authenticated user.
   */
  async getMyVisitedPlaces({
    userId,
    limit = 20,
    cursor = null,
  }) {
    const decodedCursor =
      decodeCursor(cursor);

    const listResult =
      await VisitedPlacesRepository
        .listVisitedPlaces({
          userId,
          limit,

          cursor:
            decodedCursor
              ? {
                  visitedAt:
                    decodedCursor
                      .createdAt,

                  id:
                    decodedCursor.id,
                }
              : null,
        });

    const nextCursor =
      listResult.hasMore &&
      listResult.lastRow
        ? encodeCursor({
            createdAt:
              listResult.lastRow
                .cursor_visited_at ??
              listResult.lastRow
                .visited_at,

            id:
              listResult.lastRow.id,
          })
        : null;

    return VisitedPlacesMapper
      .toVisitedPlacesListResponse({
        rows:
          listResult.rows,

        hasMore:
          listResult.hasMore,

        nextCursor,
      });
  }
}

export default
  new VisitedPlacesService();
