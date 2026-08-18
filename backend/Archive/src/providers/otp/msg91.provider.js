import OtpProvider from "./otp.interface.js";

class Msg91Provider extends OtpProvider

 {

    name() {

        return "msg91";

    }

    async health() {

        return true;

    }

    async send() {

        throw new Error("MSG91 provider not implemented yet.");

    }

    async verify() {

        return true;

    }

}

export default new Msg91Provider();