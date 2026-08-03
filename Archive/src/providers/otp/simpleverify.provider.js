import axios from "axios";

import env from "../../config/env.js";

class SimpleVerifyProvider {

    name() {
        return "simpleverify";
    }

    async health() {
        return true;
    }

    async send({ provider, identifier }) {

        const type = provider === "phone" ? "sms" : "email";

        const response = await axios.post(
            `${env.SIMPLEVERIFY_BASE_URL}/verify/send`,
            {
                type,
                destination: identifier
            },
            {
                headers: {
                    "X-API-KEY": env.SIMPLEVERIFY_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = response.data.data;

        if (data.test?.code) {
            console.log("");
            console.log("====================================");
            console.log("📱 SIMPLEVERIFY TEST OTP");
            console.log("------------------------------------");
            console.log(`Verification ID : ${data.verification_id}`);
            console.log(`OTP             : ${data.test.code}`);
            console.log("====================================");
            console.log("");
        }

        return {
            success: true,
            provider: this.name(),
            referenceId: data.verification_id,
            verificationId: data.verification_id,
            expiresAt: data.expires_at,
            testCode: data.test?.code ?? null
        };

    }

    async verify({ verificationId, code }) {

        const response = await axios.post(
            `${env.SIMPLEVERIFY_BASE_URL}/verify/check`,
            {
                verification_id: verificationId,
                code
            },
            {
                headers: {
                    "X-API-KEY": env.SIMPLEVERIFY_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.data.valid === true;

    }

}

export default new SimpleVerifyProvider();