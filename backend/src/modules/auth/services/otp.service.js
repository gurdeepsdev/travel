// import OtpRepository from "../repositories/otp.repository.js";

// import HashService from "../../../core/security/hash.js";

// import InvalidOtpError from "../../../core/errors/auth/invalid-otp.error.js";

// class OtpService {

//     async verify({

//         provider,

//         identifier,

//         otp

//     }) {

//         const activeOtp = await OtpRepository.findActive(

//             identifier,

//             provider

//         );

//         if (!activeOtp) {

//             throw new InvalidOtpError();

//         }

//         const isValid = await HashService.compare(

//             otp,

//             activeOtp.otp_hash

//         );

//         if (!isValid) {

//             await OtpRepository.incrementAttempts(activeOtp.id);

//             throw new InvalidOtpError();

//         }

//         await OtpRepository.markVerified(activeOtp.id);

//         return activeOtp;

//     }

// }

// export default new OtpService();

import OtpRepository from "../repositories/otp.repository.js";
import InvalidOtpError from "../../../core/errors/auth/invalid-otp.error.js";
import OtpManager from "../../../providers/otp/otp-manager.js";
import HashService from "../../../core/security/hash.js";

class OtpService {

    async verify({ provider, identifier, otp }) {

        const activeOtp = await OtpRepository.findActive(
            identifier,
            provider
        );

        if (!activeOtp) {
            throw new InvalidOtpError();
        }

        let isValid;

        if (OtpManager.name() === "twilio") {

            isValid = await OtpManager.verify({
                identifier,
                code: otp
            });

        } else {

            isValid = await HashService.compare(
                otp,
                activeOtp.otp_hash
            );

        }

        if (!isValid) {
            await OtpRepository.incrementAttempts(activeOtp.id);
            throw new InvalidOtpError();
        }

        await OtpRepository.markVerified(activeOtp.id);

        return activeOtp;
    }

}

export default new OtpService();
