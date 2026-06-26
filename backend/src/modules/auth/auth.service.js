import OtpRepository from "./repositories/otp.repository.js";

import OtpManager from "../../providers/otp/otp-manager.js";

import JwtService from "../../core/security/jwt.js";
import HashService from "../../core/security/hash.js";
import OtpService from "../../core/security/otp.js";

class AuthService {

    async sendOtp({

        provider,

        identifier

    }) {

        // Generate OTP

        const otp = OtpService.generate();

        // Hash OTP

        const otpHash = await HashService.hash(otp);

        // OTP expiry (5 minutes)

        const expiresAt = new Date(Date.now() + (5 * 60 * 1000));

        // Store in database

        await OtpRepository.create({

            identifier,

            provider,

            otpHash,

            expiresAt

        });

        // Send OTP

        await OtpManager.send({

            identifier,

            otp

        });

        return {

            provider,

            identifier,

            expiresAt

        };

    }

}

export default new AuthService();