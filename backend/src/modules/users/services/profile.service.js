// cat > src/modules/users/services/profile.service.js <<'EOF'
import UserNotFoundError from "../../../core/errors/users/user-not-found.error.js";
import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

import profileMapper from "../mappers/profile.mapper.js";
import { profilesRepository } from "../repositories/index.js";


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
}) {
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

  try {
    updatedProfileReference =
      await profilesRepository
        .updatePartial({
          userId,
          changes,
        });
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
