import AppError from "../app-error.js";

import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

export default class InvalidRefreshTokenError extends AppError {

    constructor(options = {}) {

        super({

            code: ErrorCodes.AUTH.INVALID_REFRESH_TOKEN,

            message: "The refresh token is invalid.",

            statusCode: HttpStatus.UNAUTHORIZED,

            details: null,

            cause: null,

            ...options

        });

    }

}