import { ZodError } from "zod";

import AppError from "../core/errors/app-error.js";
import ErrorCodes from "../shared/constants/error-codes.js";
import HttpStatus from "../shared/constants/http-status.js";

export default function validate(schema) {

    return async (req, res, next) => {

        try {

            req.validated = await schema.parseAsync({

                body: req.body,

                params: req.params,

                query: req.query

            });

            next();

        } catch (error) {

            if (error instanceof ZodError) {

                return next(new AppError({

                    code: ErrorCodes.COMMON.VALIDATION_FAILED,

                    message: "Validation failed.",

                    statusCode: HttpStatus.BAD_REQUEST,

                    details: error.flatten()

                }));

            }

            next(error);

        }

    };

}