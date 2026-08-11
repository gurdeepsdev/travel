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

import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

const MAX_VISIT_EVIDENCE_BYTES =
  15 * 1024 * 1024;

const ALLOWED_VISIT_EVIDENCE_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
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
        `artictern-visit-evidence-${randomUUID()}`,
      );
    },
  });

const multipartUpload =
  multer({
    storage:
      temporaryStorage,

    limits: {
      files:
        1,

      fileSize:
        MAX_VISIT_EVIDENCE_BYTES,

      fields:
        5,

      fieldNameSize:
        100,

      fieldSize:
        64 * 1024,

      parts:
        6,
    },

    fileFilter: (
      req,
      file,
      callback,
    ) => {
      if (
        !ALLOWED_VISIT_EVIDENCE_MIME_TYPES
          .has(file.mimetype)
      ) {
        return callback(
          new AppError({
            code:
              ErrorCodes
                .VISITED_PLACE
                .EVIDENCE_INVALID_TYPE,

            message:
              "Visit evidence image type is not supported.",

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

const receiveVisitEvidence =
  multipartUpload.single(
    "verificationPhoto",
  );

async function cleanupVisitEvidenceFile(
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
  let cleanupStarted =
    false;

  const cleanup = () => {
    if (cleanupStarted) {
      return;
    }

    cleanupStarted =
      true;

    void cleanupVisitEvidenceFile(
      req,
    )
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
          "Failed to clean temporary visit evidence image.",
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

function createEvidenceRequiredError() {
  return new AppError({
    code:
      ErrorCodes
        .VISITED_PLACE
        .EVIDENCE_REQUIRED,

    message:
      "Visit verification photo is required.",

    statusCode:
      HttpStatus.BAD_REQUEST,

    details: {
      field:
        "verificationPhoto",
    },
  });
}

function visitedPlaceVerificationUploadMiddleware(
  req,
  res,
  next,
) {
  receiveVisitEvidence(
    req,
    res,
    (error) => {
      if (!error) {
        if (!req.file) {
          return next(
            createEvidenceRequiredError(),
          );
        }

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
                ErrorCodes
                  .VISITED_PLACE
                  .EVIDENCE_TOO_LARGE,

              message:
                "Visit evidence image is too large.",

              statusCode:
                HttpStatus
                  .PAYLOAD_TOO_LARGE,

              details: {
                field:
                  error.field ?? null,

                maximumBytes:
                  MAX_VISIT_EVIDENCE_BYTES,
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
            ErrorCodes
              .VISITED_PLACE
              .EVIDENCE_UPLOAD_FAILED,

          message:
            "Visit evidence image could not be received.",

          statusCode:
            HttpStatus
              .INTERNAL_SERVER_ERROR,

          details:
            null,

          cause:
            error,
        }),
      );
    },
  );
}

export {
  ALLOWED_VISIT_EVIDENCE_MIME_TYPES,
  MAX_VISIT_EVIDENCE_BYTES,
  cleanupVisitEvidenceFile,
};

export default
  visitedPlaceVerificationUploadMiddleware;
