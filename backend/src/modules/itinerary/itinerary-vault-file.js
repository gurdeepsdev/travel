import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { fileTypeFromFile } from "file-type";

import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../../shared/constants/error-codes.js";
import HttpStatus from "../../shared/constants/http-status.js";
import {
  ALLOWED_VAULT_MIME_TYPES,
  MAX_VAULT_DOCUMENT_BYTES,
} from "./itinerary-vault-upload.middleware.js";

async function checksum(path) {
  const hash = createHash("sha256");
  for await (
    const chunk of createReadStream(path)
  ) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function inspectVaultFile(file) {
  if (!file?.path) {
    throw new AppError({
      code:
        ErrorCodes.ITINERARY
          .VAULT_FILE_REQUIRED,
      message:
        "Vault document file is required.",
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }

  const [details, detected] =
    await Promise.all([
      stat(file.path),
      fileTypeFromFile(file.path),
    ]);

  if (
    !detected ||
    !ALLOWED_VAULT_MIME_TYPES.has(
      detected.mime,
    ) ||
    detected.mime !== file.mimetype
  ) {
    throw new AppError({
      code:
        ErrorCodes.ITINERARY
          .VAULT_INVALID_FILE_TYPE,
      message:
        "Vault document type is not supported.",
      statusCode:
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    });
  }

  if (
    details.size >
    MAX_VAULT_DOCUMENT_BYTES
  ) {
    throw new AppError({
      code:
        ErrorCodes.ITINERARY
          .VAULT_FILE_TOO_LARGE,
      message:
        "Vault document is too large.",
      statusCode:
        HttpStatus.PAYLOAD_TOO_LARGE,
    });
  }

  return {
    temporaryPath: file.path,
    originalFilename:
      basename(file.originalname)
        .replaceAll("\0", "")
        .slice(0, 255),
    mimeType: detected.mime,
    extension: detected.ext,
    fileSize: details.size,
    checksum:
      await checksum(file.path),
  };
}

export { inspectVaultFile };
