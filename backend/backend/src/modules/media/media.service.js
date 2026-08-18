import {
  constants as fileConstants,
} from "node:fs";

import {
  access,
} from "node:fs/promises";

import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";

import {
  resolveStoragePath,
} from "../../providers/storage/local.provider.js";

import MediaRepository from "./media.repository.js";

function createAssetNotFoundError() {
  return new AppError({
    code:
      ErrorCodes.MEDIA
        .ASSET_NOT_FOUND,

    message:
      "Media asset not found.",

    statusCode:
      HttpStatus.NOT_FOUND,

    details: null,
  });
}

class MediaService {
  async getLocalAssetContent({
    assetId,
    viewerUserId = null,
  }) {
    const asset =
      await MediaRepository
        .findDeliveryContext({
          assetId,
          viewerUserId,
        });

    if (
      !asset ||
      String(
        asset.storage_provider,
      )
        .toLowerCase() !==
        "local"
    ) {
      throw createAssetNotFoundError();
    }

    let filePath;

    try {
      filePath =
        resolveStoragePath(
          asset.storage_key,
        );

      await access(
        filePath,
        fileConstants.R_OK,
      );
    } catch (error) {
      throw new AppError({
        code:
          ErrorCodes.MEDIA
            .CONTENT_UNAVAILABLE,

        message:
          "Media content is temporarily unavailable.",

        statusCode:
          HttpStatus
            .SERVICE_UNAVAILABLE,

        details: null,

        cause:
          error,
      });
    }

    return {
      asset,
      filePath,

      cacheControl:
        asset.is_public === true
          ? "public, max-age=3600"
          : "private, no-store",
    };
  }
}

export {
  createAssetNotFoundError,
};

export default new MediaService();