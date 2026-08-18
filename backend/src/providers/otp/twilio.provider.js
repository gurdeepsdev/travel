import twilio from "twilio";

import env from "../../config/env.js";

class TwilioProvider {

    constructor() {

        this.client = twilio(
            env.TWILIO_ACCOUNT_SID,
            env.TWILIO_AUTH_TOKEN
        );

    }

    name() {
        return "twilio";
    }

    async send({ identifier }) {

        const to = identifier.startsWith("+")
            ? identifier
            : `+91${identifier}`;

        const verification =
            await this.client.verify.v2
                .services(env.TWILIO_VERIFY_SERVICE_SID)
                .verifications
                .create({
                    to,
                    channel: "sms"
                });

        return {
            success: true,
            provider: this.name(),
            referenceId: verification.sid,
            status: verification.status
        };

    }

    async verify({ identifier, code }) {

        const to = identifier.startsWith("+")
            ? identifier
            : `+91${identifier}`;

        const result =
            await this.client.verify.v2
                .services(env.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks
                .create({
                    to,
                    code
                });

        return result.status === "approved";

    }

}

export default new TwilioProvider();