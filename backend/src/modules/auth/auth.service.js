import OtpRepository from "./repositories/otp.repository.js";
import OtpManager from "../../providers/otp/otp-manager.js";

import HashService from "../../core/security/hash.js";
import OtpGenerator from "../../core/security/otp.js";

// import {
//     IdentityService,
//     SessionService,
//     SecurityService
// } from "./services/index.js";

import {
    OtpService,
    IdentityService,
    SessionService,
    SecurityService
} from "./services/index.js";

class AuthService {

    async sendOtp({

        provider,

        identifier

    }) {

        // Generate OTP
        const otp = OtpGenerator.generate();
        // const otp = OtpService.generate();

        // Hash OTP

        const otpHash = await HashService.hash(otp);

        // OTP expiry (5 minutes)

        const expiresAt = new Date(Date.now() + (5 * 60 * 1000));

        // Store in database

    // Store or update active OTP

const activeOtp = await OtpRepository.findActive(
    identifier,
    provider
);

if (activeOtp) {

    await OtpRepository.updateActive({

        id: activeOtp.id,

        otpHash,

        expiresAt

    });

} else {

    await OtpRepository.create({

        identifier,

        provider,

        otpHash,

        expiresAt

    });

}


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

    async verifyOtp({

        provider,
    
        identifier,
    
        otp,
    
        deviceName = null,
    
        deviceType = null,
    
        ipAddress = null,
    
        userAgent = null
    
    }) {
    
        await OtpService.verify({
    
            provider,
    
            identifier,
    
            otp
    
        });
    
        const user = await IdentityService.resolve({
    
            provider,
    
            identifier
    
        });
    
        const {
    
            accessToken,
    
            refreshToken,
    
            session
    
        } = await SessionService.create({
    
            user,
    
            deviceName,
    
            deviceType,
    
            ipAddress,
    
            userAgent
    
        });
    
        await SecurityService.loginSuccess({
    
            user,
    
            provider,
    
            identifier,
    
            ipAddress,
    
            userAgent
    
        });
    
        return {
    
            user,
    
            session,
    
            accessToken,
    
            refreshToken
    
        };
    
    }



    async refresh({

        refreshToken
    
    }) {
    
        const {
    
            session,
    
            accessToken,
    
            refreshToken: newRefreshToken
    
        } = await SessionService.refresh({
    
            refreshToken
    
        });
    
        const {
    
            user,
    
            profile,
    
            identity
    
        } = await IdentityService.resolveByUserId(
    
            session.user_id
    
        );
    
        return {
    
            user,
    
            profile,
    
            identity,
    
            session,
    
            accessToken,
    
            refreshToken: newRefreshToken
    
        };
    
    }

    async logout({

        sessionId
    
    }) {
    
        await SessionService.logout({
    
            sessionId
    
        });
    
    }

    async logoutAll({

        userId
    
    }) {
    
        await SessionService.logoutAll({
    
            userId
    
        });
    
    }

    async getSessions({

        userId
    
    }) {
    
        return SessionService.getSessions({
    
            userId
    
        });
    
    }
    
    async revokeSession({
    
        sessionId,
    
        userId
    
    }) {
    
        await SessionService.revokeSession({
    
            sessionId,
    
            userId
    
        });
    
    }

}

export default new AuthService();