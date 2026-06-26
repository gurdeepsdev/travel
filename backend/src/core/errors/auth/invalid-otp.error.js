import AppError from "../app-error.js";

import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

export default class InvalidOtpError extends AppError {

    constructor(options = {}) {

        super({

            code: ErrorCodes.AUTH.INVALID_OTP,

            message: "The OTP provided is invalid.",

            statusCode: HttpStatus.UNAUTHORIZED,

            details: null,

            cause: null,

            ...options

        });

    }

}