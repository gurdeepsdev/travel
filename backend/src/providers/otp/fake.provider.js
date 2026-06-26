import OtpProvider from "./otp.interface.js";

class FakeOtpProvider extends OtpProvider


  {

    name() {

        return "fake";

    }

    async health() {

        return true;

    }

    async send({ identifier, otp }) {

        console.log("");

        console.log("====================================");

        console.log("📱 FAKE OTP PROVIDER");

        console.log("------------------------------------");

        console.log(`Recipient : ${identifier}`);

        console.log(`OTP       : ${otp}`);

        console.log("====================================");

        console.log("");

        return {

            success: true,

            provider: this.name(),

            referenceId: `fake_${Date.now()}`

        };

    }

    async verify() {

        return true;

    }

}

export default new FakeOtpProvider();