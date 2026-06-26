import { Router } from "express";

import InvalidOtpError from "../core/errors/auth/invalid-otp.error.js";

const router = Router();

router.get("/error", (req, res, next) => {

    next(new InvalidOtpError());

});

export default router;