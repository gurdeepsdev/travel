import AppError from "../core/errors/app-error.js";
import Response from "../core/response/index.js";
import ErrorCodes from "../shared/constants/error-codes.js";
import HttpStatus from "../shared/constants/http-status.js";

export default function errorMiddleware(err, req, res, next) {

    if (res.headersSent) {
        return next(err);
    }

    req.logger?.error({
        error: {
            name: err.name,
            code: err.code,
            message: err.message,
            stack: err.stack
        }
    }, "Unhandled Exception");

    if (err instanceof AppError) {

        return Response.error(res, {

            statusCode: err.statusCode,

            code: err.code,

            message: err.message,

            details: err.details

        });

    }

    return Response.error(res, {

        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,

        code: ErrorCodes.COMMON.INTERNAL_SERVER_ERROR,

        message: "An unexpected error occurred.",

        details: null

    });

}