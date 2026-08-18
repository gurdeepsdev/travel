import AppError from "../core/errors/app-error.js";
import Response from "../core/response/index.js";
import ErrorCodes from "../shared/constants/error-codes.js";
import HttpStatus from "../shared/constants/http-status.js";

function createLogPayload(error) {
  return {
    error: {
      name: error.name,
      code: error.code ?? null,
      message: error.message,
      statusCode: error.statusCode ?? null,
      isOperational: error.isOperational === true,
      stack: error.stack,
      cause: error.cause
        ? {
            name: error.cause.name,
            message: error.cause.message,
          }
        : null,
    },
  };
}

export default function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    const logPayload = createLogPayload(error);

    if (error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      req.logger?.error(logPayload, "Operational Server Error");
    } else {
      req.logger?.warn(logPayload, "Operational Request Error");
    }

    return Response.error(res, {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  req.logger?.error(createLogPayload(error), "Unhandled Application Exception");

  return Response.error(res, {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCodes.COMMON.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred.",
    details: null,
  });
}
