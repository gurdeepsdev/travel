import { Router } from "express";

import AuthController from "./auth.controller.js";
import validate from "../../middleware/validate.middleware.js";
import {

    sendOtpSchema,

    verifyOtpSchema,

    refreshTokenSchema

} from "./auth.validation.js";
import AuthMiddleware from "../../middleware/auth.middleware.js";


const router = Router();

router.post(
    "/send-otp",
    validate(sendOtpSchema),
    AuthController.sendOtp
);
router.post(
    "/verify-otp",
    validate(verifyOtpSchema),
    AuthController.verifyOtp
);

router.get(

    "/me",

    AuthMiddleware.authenticate,

    AuthController.me

);

router.post(

    "/refresh",

    validate(refreshTokenSchema),

    AuthController.refresh

);

router.post(

    "/logout",

    AuthMiddleware.authenticate,

    AuthController.logout

);

router.post(

    "/logout-all",

    AuthMiddleware.authenticate,

    AuthController.logoutAll

);

router.get(

    "/sessions",

    AuthMiddleware.authenticate,

    AuthController.getSessions

);

router.delete(

    "/sessions/:sessionId",

    AuthMiddleware.authenticate,

    AuthController.revokeSession

);

export default router;