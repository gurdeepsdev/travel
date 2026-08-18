import OtpProvider from "./otp.interface.js";

class FakeOtpProvider extends OtpProvider {

    constructor() {

        super();

        this.latestOtps = new Map();

    }

    name() {

        return "fake";

    }

    async health() {

        return true;

    }

    async send({ identifier, otp }) {

        // Store latest OTP for integration tests
        this.latestOtps.set(identifier, otp);

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

    getLatestOtp(identifier) {

        return this.latestOtps.get(identifier);

    }

    clear() {

        this.latestOtps.clear();

    }

    async verify() {

        return true;

    }

}

export default new FakeOtpProvider();