// cat > src/modules/users/services/profile.service.js <<'EOF'
import Database from "../../../database/database-manager.js";

import StorageManager from "../../../providers/storage/storage-manager.js";
import UserNotFoundError from "../../../core/errors/users/user-not-found.error.js";
import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";
import MediaRepository from "../../media/media.repository.js";

import profileMapper from "../mappers/profile.mapper.js";
import { profilesRepository } from "../repositories/index.js";

import {
  inspectProfilePhotoFile,
} from "../utils/profile-photo-file.util.js";



function createProfileValidationError(
  message,
) {
  return new AppError({
    code:
      ErrorCodes.COMMON
        .VALIDATION_FAILED,

    message:
      "Validation failed.",

    statusCode:
      HttpStatus.BAD_REQUEST,

    details: {
      formErrors: [],

      fieldErrors: {
        body: [
          message,
        ],
      },
    },
  });
}

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



class ProfileService {


  async getMyProfile(userId) {
    const profile = await profilesRepository.findByUserId(userId);

    if (!profile) {
      throw new UserNotFoundError({
        details: {
          userId,
        },
      });
    }

    return profileMapper.toResponse(profile);
  }

  /**
 * Partially updates the authenticated user's
 * active profile.
 *
 * Only fields supplied in changes are written.
 */
async updateMyProfile({
  userId,
  changes,
  profilePhotoFile = null,
  logger = null,
}) {
  const hasUploadedPhoto =
    Boolean(
      profilePhotoFile,
    );

  const hasProfileChanges =
    Object.keys(
      changes,
    ).length > 0;

  if (
    !hasProfileChanges &&
    !hasUploadedPhoto
  ) {
    throw createProfileValidationError(
      "At least one profile field or profile photo must be provided.",
    );
  }

  if (
    hasUploadedPhoto &&
    Object.hasOwn(
      changes,
      "profilePhotoAssetId",
    )
  ) {
    throw createProfileValidationError(
      "Profile photo upload and profilePhotoAssetId cannot be provided together.",
    );
  }
  const currentProfile =
    await profilesRepository
      .findUpdateContext(userId);

  if (!currentProfile) {
    throw new UserNotFoundError({
      details: {
        userId,
      },
    });
  }

  /*
   * Pre-check provides a clear conflict response.
   * PostgreSQL 23505 is also handled below to
   * protect against concurrent requests.
   */
  if (
    Object.hasOwn(
      changes,
      "username",
    )
  ) {
    const usernameConflict =
      await profilesRepository
        .findUsernameConflict({
          username:
            changes.username,

          userId,
        });

    if (usernameConflict) {
      throw new AppError({
        code:
          ErrorCodes.USER
            .USERNAME_ALREADY_EXISTS,

        message:
          "Username is already in use.",

        statusCode:
          HttpStatus.CONFLICT,
      });
    }
  }

  /*
   * null intentionally removes the current photo.
   * A UUID must reference an active image uploaded
   * by the authenticated user.
   */
  if (
    Object.hasOwn(
      changes,
      "profilePhotoAssetId",
    ) &&
    changes.profilePhotoAssetId !== null
  ) {
    const profilePhoto =
      await profilesRepository
        .findOwnedProfilePhoto({
          assetId:
            changes.profilePhotoAssetId,

          userId,
        });

    if (!profilePhoto) {
      throw new AppError({
        code:
          ErrorCodes.PROFILE
            .PHOTO_NOT_ALLOWED,

        message:
          "Profile photo is unavailable or is not owned by the user.",

        statusCode:
          HttpStatus
            .UNPROCESSABLE_ENTITY,
      });
    }
  }

  const countryWasProvided =
    Object.hasOwn(
      changes,
      "countryId",
    );

  const cityWasProvided =
    Object.hasOwn(
      changes,
      "cityId",
    );

  const effectiveCountryId =
    countryWasProvided
      ? changes.countryId
      : currentProfile.country_id;

  const effectiveCityId =
    cityWasProvided
      ? changes.cityId
      : currentProfile.city_id;

  if (
    countryWasProvided &&
    changes.countryId !== null
  ) {
    const country =
      await profilesRepository
        .findActiveCountry(
          changes.countryId,
        );

    if (!country) {
      throw new AppError({
        code:
          ErrorCodes.PROFILE
            .COUNTRY_NOT_FOUND,

        message:
          "Selected country was not found or is inactive.",

        statusCode:
          HttpStatus
            .UNPROCESSABLE_ENTITY,
      });
    }
  }


  /*
   * When either location field changes, validate
   * the effective city-country pair. This prevents
   * a country-only PATCH from leaving an existing
   * city attached to a different country.
   */
  /*
 * When either location field changes, validate
 * the effective city-country pair.
 */
if (
  (
    countryWasProvided ||
    cityWasProvided
  ) &&
  effectiveCityId !== null
) {
  const effectiveCity =
    await profilesRepository
      .findActiveCity(
        effectiveCityId,
      );
    if (!effectiveCity) {
      throw new AppError({
        code:
          ErrorCodes.PROFILE
            .CITY_NOT_FOUND,

        message:
          "Selected city was not found or is inactive.",

        statusCode:
          HttpStatus
            .UNPROCESSABLE_ENTITY,
      });
    }

    const cityCountryMatches =
      effectiveCountryId !== null &&
      String(
        effectiveCity.country_id,
      ) ===
        String(effectiveCountryId);

    if (!cityCountryMatches) {
      throw new AppError({
        code:
          ErrorCodes.PROFILE
            .CITY_COUNTRY_MISMATCH,

        message:
          "Selected city does not belong to the selected country.",

        statusCode:
          HttpStatus
            .UNPROCESSABLE_ENTITY,
      });
    }
  }

  let updatedProfileReference;

  let postCommitCleanupObjects = [];

  try {
    if (!hasUploadedPhoto) {
      updatedProfileReference =
        await profilesRepository
          .updatePartial({
            userId,
            changes,
          });
    } else {
      let inspectedPhoto;

      try {
        inspectedPhoto =
          await inspectProfilePhotoFile(
            profilePhotoFile,
          );
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError({
          code:
            ErrorCodes.PROFILE
              .PHOTO_UPLOAD_FAILED,

          message:
            "Profile photo could not be inspected.",

          statusCode:
            HttpStatus
              .INTERNAL_SERVER_ERROR,

          details: null,

          cause:
            error,
        });
      }

      let storedPhoto;

      try {
        const stored =
          await StorageManager.store({
            temporaryPath:
              inspectedPhoto
                .temporaryPath,

            category:
              "profile-photos",

            userId,

            extension:
              inspectedPhoto.extension,
          });

        storedPhoto = {
          ...inspectedPhoto,
          ...stored,

          fileIndex: 0,
        };
      } catch (error) {
        throw new AppError({
          code:
            ErrorCodes.PROFILE
              .PHOTO_UPLOAD_FAILED,

          message:
            "Profile photo could not be stored.",

          statusCode:
            HttpStatus
              .INTERNAL_SERVER_ERROR,

          details: null,

          cause:
            error,
        });
      }

      try {
        const transactionResult =
          await Database.transaction(
            async (client) => {
              const resolved =
                await MediaRepository
                  .resolveUploadedAssets({
                    client,
                    userId,
                    isPublic: true,

                    uploads: [
                      storedPhoto,
                    ],
                  });

              const profilePhoto =
                resolved.assets[0] ??
                null;

              if (!profilePhoto) {
                throw new AppError({
                  code:
                    ErrorCodes.PROFILE
                      .PHOTO_UPLOAD_FAILED,

                  message:
                    "Profile photo asset could not be created.",

                  statusCode:
                    HttpStatus
                      .INTERNAL_SERVER_ERROR,

                  details: null,
                });
              }

              const transactionChanges = {
                ...changes,

                profilePhotoAssetId:
                  profilePhoto.id,
              };

              const updatedReference =
                await profilesRepository
                  .updatePartial({
                    userId,

                    changes:
                      transactionChanges,

                    client,
                  });

              if (!updatedReference) {
                throw new UserNotFoundError({
                  details: {
                    userId,
                  },
                });
              }

              return {
                updatedReference,

                cleanupObjects: [
                  ...resolved
                    .unusedStoredObjects,

                  ...resolved
                    .supersededStoredObjects,
                ],
              };
            },
          );

        updatedProfileReference =
          transactionResult
            .updatedReference;

        postCommitCleanupObjects =
          transactionResult
            .cleanupObjects;
      } catch (error) {
        await cleanupStorageObjects({
          objects: [
            storedPhoto,
          ],

          logger,

          logMessage:
            "Failed to clean profile photo after transaction failure.",
        });

        throw error;
      }
    }
  } catch (error) {
    /*
     * Race-safe username conflict handling.
     */
    if (error.code === "23505") {
      throw new AppError({
        code:
          ErrorCodes.USER
            .USERNAME_ALREADY_EXISTS,

        message:
          "Username is already in use.",

        statusCode:
          HttpStatus.CONFLICT,

        cause: error,
      });
    }

    /*
     * A referenced asset or POI may be removed
     * between validation and UPDATE.
     */
    if (error.code === "23503") {
      const constraint =
        String(
          error.constraint ?? "",
        ).toLowerCase();

      if (
        constraint.includes(
          "profile_photo",
        )
      ) {
        throw new AppError({
          code:
            ErrorCodes.PROFILE
              .PHOTO_NOT_ALLOWED,

          message:
            "Profile photo is unavailable or is not owned by the user.",

          statusCode:
            HttpStatus
              .UNPROCESSABLE_ENTITY,

          cause: error,
        });
      }

      if (
        constraint.includes("country")
      ) {
        throw new AppError({
          code:
            ErrorCodes.PROFILE
              .COUNTRY_NOT_FOUND,

          message:
            "Selected country was not found or is inactive.",

          statusCode:
            HttpStatus
              .UNPROCESSABLE_ENTITY,

          cause: error,
        });
      }

      if (
        constraint.includes("city")
      ) {
        throw new AppError({
          code:
            ErrorCodes.PROFILE
              .CITY_NOT_FOUND,

          message:
            "Selected city was not found or is inactive.",

          statusCode:
            HttpStatus
              .UNPROCESSABLE_ENTITY,

          cause: error,
        });
      }
    }

    throw error;
  }
   await cleanupStorageObjects({
    objects:
      postCommitCleanupObjects,

    logger,

    logMessage:
      "Failed to clean redundant profile-photo storage objects.",
  });

  if (!updatedProfileReference) {
    throw new UserNotFoundError({
      details: {
        userId,
      },
    });
  }

  /*
   * Return the same complete canonical profile
   * structure already used by GET /users/me.
   */
  const updatedProfile =
    await profilesRepository
      .findByUserId(userId);

  if (!updatedProfile) {
    throw new UserNotFoundError({
      details: {
        userId,
      },
    });
  }

  return profileMapper.toResponse(
    updatedProfile,
  );
}


}

export default new ProfileService();
