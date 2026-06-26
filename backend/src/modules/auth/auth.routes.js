import { Router } from "express";

import AuthController from "./auth.controller.js";
import validate from "../../middleware/validate.middleware.js";
import { sendOtpSchema } from "./auth.validation.js";

const router = Router();

router.post(
    "/send-otp",
    validate(sendOtpSchema),
    AuthController.sendOtp
);

export default router;