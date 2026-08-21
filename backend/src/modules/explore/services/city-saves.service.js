import AppError
  from "../../../core/errors/app-error.js";
import ErrorCodes
  from "../../../shared/constants/error-codes.js";
import HttpStatus
  from "../../../shared/constants/http-status.js";

import CitySavesMapper
  from "../mappers/city-saves.mapper.js";
import CitySavesRepository
  from "../repositories/city-saves.repository.js";

class CitySavesService {
  createNotFoundError() {
    return new AppError({
      code:
        ErrorCodes.CITY.NOT_FOUND,
      message:
        "City not found.",
      statusCode:
        HttpStatus.NOT_FOUND,
    });
  }

  async assertCityExists({
    cityId,
  }) {
    const city =
      await CitySavesRepository
        .findActiveCity({
          cityId,
        });

    if (!city) {
      throw this.createNotFoundError();
    }

    return city;
  }

  async saveCity({
    cityId,
    userId,
  }) {
    await this.assertCityExists({
      cityId,
    });

    const savedItem =
      await CitySavesRepository.save({
        cityId,
        userId,
      });

    if (!savedItem) {
      throw this.createNotFoundError();
    }

    const state =
      await CitySavesRepository
        .getState({
          cityId,
          userId,
        });

    return CitySavesMapper
      .toResponse({
        cityId,
        state,
      });
  }

  async removeSavedCity({
    cityId,
    userId,
  }) {
    await this.assertCityExists({
      cityId,
    });

    await CitySavesRepository.remove({
      cityId,
      userId,
    });

    const state =
      await CitySavesRepository
        .getState({
          cityId,
          userId,
        });

    return CitySavesMapper
      .toResponse({
        cityId,
        state,
      });
  }
}

export default new CitySavesService();
