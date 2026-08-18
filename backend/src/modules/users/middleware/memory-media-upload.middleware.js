import {
  randomUUID,
} from "node:crypto";

import {
  unlink,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import multer from "multer";

import AppError from "../../../core/errors/app-error.js";
import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

const MAX_MEMORY_IMAGE_BYTES =
  25 * 1024 * 1024;

const MAX_MEMORY_VIDEO_BYTES =
  250 * 1024 * 1024;

const ALLOWED_MEMORY_MEDIA_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ]);

const temporaryStorage =
  multer.diskStorage({
    destination: (
      req,
      file,
      callback,
    ) => {
      callback(
        null,
        tmpdir(),
      );
    },

    filename: (
      req,
      file,
      callback,
    ) => {
      callback(
        null,
        `artictern-memory-${randomUUID()}`,
      );
    },
  });

const multipartUpload =
  multer({
    storage:
      temporaryStorage,

    limits: {
      files: 1,

      fileSize:
        MAX_MEMORY_VIDEO_BYTES,

      fields: 5,

      fieldNameSize: 100,

      fieldSize:
        64 * 1024,

      parts: 6,
    },

    fileFilter: (
      req,
      file,
      callback,
    ) => {
      if (
        !ALLOWED_MEMORY_MEDIA_MIME_TYPES
          .has(file.mimetype)
      ) {
        return callback(
          new AppError({
            code:
              ErrorCodes.MEMORY
                .MEDIA_INVALID_TYPE,

            message:
              "Memory media type is not supported.",

            statusCode:
              HttpStatus
                .UNSUPPORTED_MEDIA_TYPE,

            details: {
              field:
                file.fieldname,

              mimeType:
                file.mimetype,
            },
          }),
        );
      }

      return callback(
        null,
        true,
      );
    },
  });

const receiveMemoryMedia =
  multipartUpload.single(
    "memoryFile",
  );

async function cleanupMemoryMediaFile(
  req,
) {
  if (!req.file?.path) {
    return;
  }

  try {
    await unlink(
      req.file.path,
    );
  } catch (error) {
    if (
      error?.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

function registerResponseCleanup(
  req,
  res,
) {
  let cleanupStarted = false;

  const cleanup = () => {
    if (cleanupStarted) {
      return;
    }

    cleanupStarted = true;

    void cleanupMemoryMediaFile(
      req,
    ).catch((error) => {
      req.logger?.error(
        {
          error: {
            name:
              error.name,

            message:
              error.message,

            stack:
              error.stack,
          },
        },
        "Failed to clean temporary memory media.",
      );
    });
  };

  res.once(
    "finish",
    cleanup,
  );

  res.once(
    "close",
    cleanup,
  );
}

function createMultipartValidationError(
  error,
) {
  return new AppError({
    code:
      ErrorCodes.COMMON
        .VALIDATION_FAILED,

    message:
      "Multipart request validation failed.",

    statusCode:
      HttpStatus.BAD_REQUEST,

    details: {
      field:
        error.field ?? null,

      reason:
        error.code,
    },
  });
}

function memoryMediaUploadMiddleware(
  req,
  res,
  next,
) {
  receiveMemoryMedia(
    req,
    res,
    (error) => {
      if (!error) {
        registerResponseCleanup(
          req,
          res,
        );

        return next();
      }

      if (
        error instanceof AppError
      ) {
        return next(error);
      }

      if (
        error instanceof
          multer.MulterError
      ) {
        if (
          error.code ===
          "LIMIT_FILE_SIZE"
        ) {
          return next(
            new AppError({
              code:
                ErrorCodes.MEMORY
                  .MEDIA_TOO_LARGE,

              message:
                "Memory media is too large.",

              statusCode:
                HttpStatus
                  .PAYLOAD_TOO_LARGE,

              details: {
                field:
                  error.field ?? null,

                maximumBytes:
                  MAX_MEMORY_VIDEO_BYTES,
              },
            }),
          );
        }

        return next(
          createMultipartValidationError(
            error,
          ),
        );
      }

      return next(
        new AppError({
          code:
            ErrorCodes.MEMORY
              .MEDIA_UPLOAD_FAILED,

          message:
            "Memory media could not be received.",

          statusCode:
            HttpStatus
              .INTERNAL_SERVER_ERROR,

          details: null,

          cause:
            error,
        }),
      );
    },
  );
}

export {
  ALLOWED_MEMORY_MEDIA_MIME_TYPES,
  MAX_MEMORY_IMAGE_BYTES,
  MAX_MEMORY_VIDEO_BYTES,
  cleanupMemoryMediaFile,
};

export default memoryMediaUploadMiddleware;
