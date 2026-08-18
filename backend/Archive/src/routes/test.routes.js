import { Router } from "express";

import InvalidOtpError from "../core/errors/auth/invalid-otp.error.js";
import AuthMiddleware from "../middleware/auth.middleware.js";
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
router.get(
    "/protected",
    AuthMiddleware.authenticate,
    (req, res) => {

        console.dir(req.context, {
            depth: null
        });

        res.json({

            success: true,
        
            user: req.user,
        
            profile: req.profile,
        
            identity: req.identity
        
        });

    }
);


// router.get(
//     "/protected",
//     AuthMiddleware.authenticate,
//     (req, res) => {

//         res.json({

//             success: true,

//             user: req.user,

//             session: req.session,

//             identity: req.identity,

//             context: req.context

//         });

//     }
// );

export default router;