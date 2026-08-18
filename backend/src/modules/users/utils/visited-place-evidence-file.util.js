import {
  createHash,
} from "node:crypto";

import {
  createReadStream,
} from "node:fs";

import {
  stat,
} from "node:fs/promises";

import {
  basename,
} from "node:path";

import {
  fileTypeFromFile,
} from "file-type";

import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

import {
  ALLOWED_VISIT_EVIDENCE_MIME_TYPES,
  MAX_VISIT_EVIDENCE_BYTES,
} from "../middleware/visited-place-verification-upload.middleware.js";

const COMPATIBLE_HEIF_MIME_TYPES =
  new Set([
    "image/heic",
    "image/heif",
  ]);

function createInvalidEvidenceError({
  declaredMimeType = null,
  detectedMimeType = null,
  reason,
}) {
  return new AppError({
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
      declaredMimeType,
      detectedMimeType,
      reason,
    },
  });
}

function mimeTypesAreCompatible({
  declaredMimeType,
  detectedMimeType,
}) {
  if (
    declaredMimeType ===
    detectedMimeType
  ) {
    return true;
  }

  return (
    COMPATIBLE_HEIF_MIME_TYPES
      .has(declaredMimeType) &&
    COMPATIBLE_HEIF_MIME_TYPES
      .has(detectedMimeType)
  );
}

function normalizeOriginalFilename({
  originalname,
  fallbackExtension,
}) {
  const normalized =
    basename(
      String(
        originalname ?? "",
      ),
    )
      .replaceAll(
        "\0",
        "",
      )
      .trim();

  if (normalized) {
    return normalized.slice(
      0,
      255,
    );
  }

  return (
    `visit-evidence.${fallbackExtension}`
  );
}

async function calculateEvidenceChecksum(
  filePath,
) {
  const hash =
    createHash("sha256");

  const stream =
    createReadStream(
      filePath,
    );

  for await (
    const chunk of stream
  ) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function inspectVisitedPlaceEvidenceFile(
  file,
) {
  if (!file?.path) {
    throw new AppError({
      code:
        ErrorCodes
          .VISITED_PLACE
          .EVIDENCE_UPLOAD_FAILED,

      message:
        "Visit evidence temporary file is unavailable.",

      statusCode:
        HttpStatus
          .INTERNAL_SERVER_ERROR,

      details:
        null,
    });
  }

  const fileStats =
    await stat(
      file.path,
    );

  const detectedType =
    await fileTypeFromFile(
      file.path,
    );

  if (!detectedType) {
    throw createInvalidEvidenceError({
      declaredMimeType:
        file.mimetype ?? null,

      reason:
        "FILE_SIGNATURE_NOT_RECOGNIZED",
    });
  }

  if (
    !ALLOWED_VISIT_EVIDENCE_MIME_TYPES
      .has(detectedType.mime)
  ) {
    throw createInvalidEvidenceError({
      declaredMimeType:
        file.mimetype ?? null,

      detectedMimeType:
        detectedType.mime,

      reason:
        "DETECTED_TYPE_NOT_ALLOWED",
    });
  }

  if (
    !mimeTypesAreCompatible({
      declaredMimeType:
        file.mimetype,

      detectedMimeType:
        detectedType.mime,
    })
  ) {
    throw createInvalidEvidenceError({
      declaredMimeType:
        file.mimetype ?? null,

      detectedMimeType:
        detectedType.mime,

      reason:
        "DECLARED_TYPE_DOES_NOT_MATCH_FILE_SIGNATURE",
    });
  }

  if (
    fileStats.size >
      MAX_VISIT_EVIDENCE_BYTES
  ) {
    throw new AppError({
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
        actualBytes:
          fileStats.size,

        maximumBytes:
          MAX_VISIT_EVIDENCE_BYTES,
      },
    });
  }

  const checksum =
    await calculateEvidenceChecksum(
      file.path,
    );

  return {
    temporaryPath:
      file.path,

    originalFilename:
      normalizeOriginalFilename({
        originalname:
          file.originalname,

        fallbackExtension:
          detectedType.ext,
      }),

    mimeType:
      detectedType.mime,

    extension:
      detectedType.ext,

    fileSize:
      fileStats.size,

    checksum,
  };
}

export {
  calculateEvidenceChecksum,
  inspectVisitedPlaceEvidenceFile,
};
