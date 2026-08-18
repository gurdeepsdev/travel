import env from "../../config/env.js";
import security from "../../config/security.js";

class OtpService {
//old working
    // generate(length = security.otp.length) {

    //     let otp = "";
//new fake
        generate(length = security.otp.length) {

        const fixedTestOtpEnabled =
            env.FIXED_TEST_OTP_ENABLED ===
            "true";

        if (fixedTestOtpEnabled) {

            return env.FIXED_TEST_OTP;

        }

        let otp = "";

        for (let i = 0; i < length; i++) {

            otp += Math.floor(Math.random() * 10);

        }

        return otp;

    }

}

export default new OtpService();