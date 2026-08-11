import AppError
  from "../../../core/errors/app-error.js";

import ErrorCodes
  from "../../../shared/constants/error-codes.js";

import HttpStatus
  from "../../../shared/constants/http-status.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createInvalidCursorError() {
  return new AppError({
    code:
      ErrorCodes.COMMON.INVALID_CURSOR,

    message:
      "Pagination cursor is invalid.",

    statusCode:
      HttpStatus.BAD_REQUEST,
  });
}

function encodeConnectionSuggestionCursor({
  score,
  userId,
}) {
  const normalizedScore =
    Number(score);

  const normalizedUserId =
    String(userId);

  if (
    !Number.isSafeInteger(
      normalizedScore,
    ) ||
    normalizedScore < 0 ||
    !UUID_PATTERN.test(
      normalizedUserId,
    )
  ) {
    throw createInvalidCursorError();
  }

  return Buffer
    .from(
      JSON.stringify({
        score:
          normalizedScore,

        userId:
          normalizedUserId,
      }),
      "utf8",
    )
    .toString(
      "base64url",
    );
}

function decodeConnectionSuggestionCursor(
  cursor,
) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded =
      Buffer
        .from(
          cursor,
          "base64url",
        )
        .toString(
          "utf8",
        );

    const payload =
      JSON.parse(
        decoded,
      );

    if (
      !payload ||
      typeof payload !==
        "object" ||
      Array.isArray(
        payload,
      )
    ) {
      throw createInvalidCursorError();
    }

    const keys =
      Object.keys(
        payload,
      );

    if (
      keys.length !== 2 ||
      !keys.includes(
        "score",
      ) ||
      !keys.includes(
        "userId",
      )
    ) {
      throw createInvalidCursorError();
    }

    const normalizedScore =
      Number(
        payload.score,
      );

    const normalizedUserId =
      String(
        payload.userId,
      );

    if (
      !Number.isSafeInteger(
        normalizedScore,
      ) ||
      normalizedScore < 0 ||
      !UUID_PATTERN.test(
        normalizedUserId,
      )
    ) {
      throw createInvalidCursorError();
    }

    return {
      score:
        normalizedScore,

      userId:
        normalizedUserId,
    };
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code ===
        ErrorCodes.COMMON
          .INVALID_CURSOR
    ) {
      throw error;
    }

    throw createInvalidCursorError();
  }
}

export {
  encodeConnectionSuggestionCursor,
  decodeConnectionSuggestionCursor,
};
