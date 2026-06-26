import { Router } from "express";

import InvalidOtpError from "../core/errors/auth/invalid-otp.error.js";

import validate from "../middleware/validate.middleware.js";

import { sendOtpSchema } from "../modules/auth/auth.validation.js";

import Response from "../core/response/index.js";

const router = Router();

router.get("/error", (req, res, next) => {

    next(new InvalidOtpError());

});

router.post(
    "/validation",
    validate(sendOtpSchema),
    (req, res) => {

        return Response.success(

            res,

            req.validated,

            "Validation Passed"

        );

    }
);

export default router;