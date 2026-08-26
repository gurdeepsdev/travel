import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import multer from "multer";

import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";

const MAX_VAULT_DOCUMENT_BYTES =
  25 * 1024 * 1024;
const ALLOWED_VAULT_MIME_TYPES =
  new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) =>
      callback(null, tmpdir()),
    filename: (req, file, callback) =>
      callback(
        null,
        `artictern-vault-${randomUUID()}`,
      ),
  }),
  limits: {
    files: 1,
    fileSize: MAX_VAULT_DOCUMENT_BYTES,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    parts: 11,
  },
  fileFilter: (req, file, callback) => {
    if (
      !ALLOWED_VAULT_MIME_TYPES.has(
        file.mimetype,
      )
    ) {
      return callback(
        new AppError({
          code:
            ErrorCodes.ITINERARY
              .VAULT_INVALID_FILE_TYPE,
          message:
            "Vault document type is not supported.",
          statusCode:
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          details: {
            mimeType: file.mimetype,
          },
        }),
      );
    }

    return callback(null, true);
  },
}).single("documentFile");

function itineraryVaultUploadMiddleware(
  req,
  res,
  next,
) {
  upload(req, res, (error) => {
    const cleanup = () => {
      if (req.file?.path) {
        void unlink(req.file.path)
          .catch((cleanupError) => {
            if (
              cleanupError?.code !==
              "ENOENT"
            ) {
              req.logger?.error(
                { error: cleanupError },
                "Failed to clean vault upload.",
              );
            }
          });
      }
    };

    if (!error) {
      res.once("finish", cleanup);
      res.once("close", cleanup);
      return next();
    }

    if (error instanceof AppError) {
      return next(error);
    }

    const tooLarge =
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE";

    return next(
      new AppError({
        code: tooLarge
          ? ErrorCodes.ITINERARY
              .VAULT_FILE_TOO_LARGE
          : ErrorCodes.COMMON
              .VALIDATION_FAILED,
        message: tooLarge
          ? "Vault document is too large."
          : "Vault document upload is invalid.",
        statusCode: tooLarge
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST,
        details: tooLarge
          ? {
              maximumBytes:
                MAX_VAULT_DOCUMENT_BYTES,
            }
          : null,
        cause: error,
      }),
    );
  });
}

export {
  ALLOWED_VAULT_MIME_TYPES,
  MAX_VAULT_DOCUMENT_BYTES,
};
export default itineraryVaultUploadMiddleware;
