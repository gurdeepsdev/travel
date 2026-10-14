import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

import Common from "../../shared/validators/common.validators.js";

const phoneIdentifier = z.string()
    .regex(/^(?:[0-9]{10}|\+[1-9][0-9]{1,14})$/, "Use a 10-digit Indian number or an international number with + and country code.")
    .refine(value => {
        const international = value.startsWith("+");
        const number = parsePhoneNumberFromString(value, { defaultCountry: "IN", extract: false });
        return Boolean(number?.isValid() && (international || number.country === "IN"));
    }, "Phone number is invalid for its country.");
const validateIdentifier = (body, ctx) => {
    const schema = body.provider === "phone" ? phoneIdentifier : Common.email;
    const result = schema.safeParse(body.identifier);
    if (!result.success) {
        for (const issue of result.error.issues) {
            ctx.addIssue({ code: "custom", path: ["identifier"], message: issue.message });
        }
    }
};

export const sendOtpSchema = z.object({

    body: z.object({

        provider: z.enum(["phone", "email"]),

        identifier: z.string()

    }).superRefine(validateIdentifier)

});

export const verifyOtpSchema = z.object({

    body: z.object({

        provider: z.enum(["phone", "email"]),

        identifier: z.string(),

        otp: Common.otp

    }).superRefine(validateIdentifier)

});

export const refreshTokenSchema = z.object({

    body: z.object({

        refreshToken: z.string().min(1).regex(/^\S+$/, "Refresh token must not contain whitespace.")

    })

});
