import AppError from "../../core/errors/app-error.js";
import ErrorCodes from "../constants/error-codes.js";
import HttpStatus from "../constants/http-status.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createInvalidCursorError() {
  return new AppError({
    code:
      ErrorCodes.COMMON.INVALID_CURSOR,
    message:
      "Pagination cursor is invalid.",
    statusCode: HttpStatus.BAD_REQUEST,
  });
}

function encodeCursor({
  createdAt,
  id,
}) {
const createdAtValue =
  createdAt instanceof Date
    ? createdAt.toISOString()
    : String(createdAt);

const normalizedDate =
  new Date(createdAtValue);

  if (
    !UUID_PATTERN.test(String(id)) ||
    Number.isNaN(normalizedDate.getTime())
  ) {
    throw createInvalidCursorError();
  }

  const payload = JSON.stringify({
createdAt: createdAtValue,
    id: String(id),
  });

  return Buffer
    .from(payload, "utf8")
    .toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer
      .from(cursor, "base64url")
      .toString("utf8");

    const payload = JSON.parse(decoded);

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw createInvalidCursorError();
    }

    const keys = Object.keys(payload);

    if (
      keys.length !== 2 ||
      !keys.includes("createdAt") ||
      !keys.includes("id")
    ) {
      throw createInvalidCursorError();
    }

    const normalizedDate =
      new Date(payload.createdAt);

    if (
      !UUID_PATTERN.test(
        String(payload.id),
      ) ||
      Number.isNaN(
        normalizedDate.getTime(),
      )
    ) {
      throw createInvalidCursorError();
    }

    return {
     createdAt:
  String(payload.createdAt),
      id: String(payload.id),
    };
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code ===
        ErrorCodes.COMMON.INVALID_CURSOR
    ) {
      throw error;
    }

    throw createInvalidCursorError();
  }
}

export {
  encodeCursor,
  decodeCursor,
};