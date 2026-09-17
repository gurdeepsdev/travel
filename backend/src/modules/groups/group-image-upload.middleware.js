import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import multer from "multer";

import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";

const MAX_GROUP_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_GROUP_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, tmpdir()),
    filename: (_req, _file, callback) =>
      callback(null, `artictern-group-image-${randomUUID()}`),
  }),
  limits: {
    files: 1,
    fileSize: MAX_GROUP_IMAGE_BYTES,
    fields: 10,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
    parts: 11,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_GROUP_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return callback(new AppError({
        code: ErrorCodes.GROUP.IMAGE_INVALID_TYPE,
        message: "Group image must be JPEG, PNG, WebP, HEIC, or HEIF.",
        statusCode: HttpStatus.BAD_REQUEST,
      }));
    }
    return callback(null, true);
  },
}).single("groupImage");

export async function cleanupGroupImageFile(file) {
  if (!file?.path) { return; }
  try { await unlink(file.path); } catch (error) {
    if (error?.code !== "ENOENT") { throw error; }
  }
}

export default function groupImageUploadMiddleware(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      const cleanup = () => { void cleanupGroupImageFile(req.file); };
      res.once("finish", cleanup);
      res.once("close", cleanup);
      return next();
    }
    if (error instanceof AppError) { return next(error); }
    if (error instanceof multer.MulterError) {
      return next(new AppError({
        code: error.code === "LIMIT_FILE_SIZE"
          ? ErrorCodes.GROUP.IMAGE_TOO_LARGE
          : ErrorCodes.COMMON.VALIDATION_FAILED,
        message: error.code === "LIMIT_FILE_SIZE"
          ? "Group image is too large."
          : "Multipart request validation failed.",
        statusCode: error.code === "LIMIT_FILE_SIZE"
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST,
        details: { field: error.field ?? null },
      }));
    }
    return next(new AppError({
      code: ErrorCodes.GROUP.IMAGE_UPLOAD_FAILED,
      message: "Group image could not be received.",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      cause: error,
    }));
  });
}
