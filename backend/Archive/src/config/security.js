import env from "./env.js";

export default {

    jwt: {

        accessSecret: env.JWT_ACCESS_SECRET,

        refreshSecret: env.JWT_REFRESH_SECRET,

        accessExpiresIn: env.JWT_ACCESS_EXPIRES,

        refreshExpiresIn: env.JWT_REFRESH_EXPIRES,

        algorithm: "HS256"

    },

    otp: {

        length: Number(process.env.OTP_LENGTH ?? 6),

        expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),

        maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5)

    },

    cookies: {

        accessToken: "artictern_access",

        refreshToken: "artictern_refresh"

    }

};