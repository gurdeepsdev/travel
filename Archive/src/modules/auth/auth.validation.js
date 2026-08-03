import { z } from "zod";

import Common from "../../shared/validators/common.validators.js";

export const sendOtpSchema = z.object({

    body: z.object({

        provider: z.enum(["phone", "email"]),

        identifier: z.union([

            Common.phone,

            Common.email

        ])

    })

});

export const verifyOtpSchema = z.object({

    body: z.object({

        provider: z.enum(["phone", "email"]),

        identifier: z.union([

            Common.phone,

            Common.email

        ]),

        otp: Common.otp

    })

});

export const refreshTokenSchema = z.object({

    body: z.object({

        refreshToken: z.string().min(1)

    })

});