import AppError from "../app-error.js";

import ErrorCodes from "../../../shared/constants/error-codes.js";
import HttpStatus from "../../../shared/constants/http-status.js";

export default class UserNotFoundError extends AppError {
  constructor(options = {}) {
    super({
      code: ErrorCodes.USER.NOT_FOUND,
      message: "User profile was not found.",
      statusCode: HttpStatus.NOT_FOUND,
      details: null,
      cause: null,
      ...options,
    });
  }
}
