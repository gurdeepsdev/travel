import AppError from "../app-error.js";

import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

export default class SessionExpiredError extends AppError {

    constructor(options = {}) {

        super({

            code: ErrorCodes.AUTH.SESSION_EXPIRED,

            message: "Session has expired.",

            statusCode: HttpStatus.UNAUTHORIZED,

            details: null,

            cause: null,

            ...options

        });

    }

}