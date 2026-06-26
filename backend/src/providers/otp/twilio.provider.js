import OtpProvider from "./otp.interface.js";

class TwilioProvider extends OtpProvider{

    name() {

        return "twilio";

    }

    async health() {

        return true;

    }

    async send() {

        throw new Error("Twilio provider not implemented yet.");

    }

    async verify() {

        return true;

    }

}

export default new TwilioProvider();