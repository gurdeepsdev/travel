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

const MAX_POST_MEDIA_FILES = 10;

const MAX_POST_IMAGE_BYTES =
  25 * 1024 * 1024;

const MAX_POST_VIDEO_BYTES =
  250 * 1024 * 1024;

const MAX_MULTIPART_FILE_BYTES =
  MAX_POST_VIDEO_BYTES;

const ALLOWED_POST_MEDIA_MIME_TYPES =
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
        `artictern-post-${randomUUID()}`,
      );
    },
  });

const multipartUpload = multer({
  storage:
    temporaryStorage,

  limits: {
    files:
      MAX_POST_MEDIA_FILES,

    fileSize:
      MAX_MULTIPART_FILE_BYTES,

    fields: 10,

    fieldNameSize: 100,

    fieldSize:
      64 * 1024,

    parts:
      MAX_POST_MEDIA_FILES + 10,
  },

  fileFilter: (
    req,
    file,
    callback,
  ) => {
    if (
      !ALLOWED_POST_MEDIA_MIME_TYPES
        .has(file.mimetype)
    ) {
      return callback(
        new AppError({
          code:
            ErrorCodes.POST
              .MEDIA_INVALID_TYPE,

          message:
            "Post media type is not supported.",

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

const uploadPostMediaFiles =
  multipartUpload.array(
    "files",
    MAX_POST_MEDIA_FILES,
  );

async function removeTemporaryFile(
  file,
) {
  if (!file?.path) {
    return;
  }

  try {
    await unlink(file.path);
  } catch (error) {
    if (
      error?.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function cleanupPostMediaFiles(
  req,
) {
  const files =
    Array.isArray(req.files)
      ? req.files
      : [];

  await Promise.all(
    files.map(
      removeTemporaryFile,
    ),
  );
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

    void cleanupPostMediaFiles(req)
      .catch((error) => {
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
          "Failed to clean temporary post media.",
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

function postMediaUploadMiddleware(
  req,
  res,
  next,
) {
  uploadPostMediaFiles(
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
                ErrorCodes.POST
                  .MEDIA_TOO_LARGE,

              message:
                "A post media file is too large.",

              statusCode:
                HttpStatus
                  .PAYLOAD_TOO_LARGE,

              details: {
                field:
                  error.field ?? null,

                maximumBytes:
                  MAX_MULTIPART_FILE_BYTES,
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
            ErrorCodes.POST
              .MEDIA_UPLOAD_FAILED,

          message:
            "Post media could not be received.",

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
  ALLOWED_POST_MEDIA_MIME_TYPES,
  MAX_POST_IMAGE_BYTES,
  MAX_POST_MEDIA_FILES,
  MAX_POST_VIDEO_BYTES,
  cleanupPostMediaFiles,
};

export default
  postMediaUploadMiddleware;