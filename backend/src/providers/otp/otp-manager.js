// import env from "../../config/env.js";

// import FakeProvider from "./fake.provider.js";
// import Msg91Provider from "./msg91.provider.js";
// import TwilioProvider from "./twilio.provider.js";
// import SimpleVerifyProvider
// from "./simpleverify.provider.js";

// class OtpManager {

//     constructor() {

//         this.provider = this.resolveProvider();

//     }

//     resolveProvider() {

//         switch (env.OTP_PROVIDER) {

//             case "msg91":

//                 return Msg91Provider;

//             case "twilio":

//                 return TwilioProvider;

//             default:

//                 return FakeProvider;

//         }

//     }

//     async send(payload) {

//         return this.provider.send(payload);

//     }

//     async verify(payload) {

//         if (typeof this.provider.verify !== "function") {

//             return true;

//         }

//         return this.provider.verify(payload);

//     }

// }

// export default new OtpManager();

import env from "../../config/env.js";

import FakeProvider from "./fake.provider.js";
import Msg91Provider from "./msg91.provider.js";
import TwilioProvider from "./twilio.provider.js";
import SimpleVerifyProvider from "./simpleverify.provider.js";

class OtpManager {

    constructor() {
        this.provider = this.resolveProvider();
    }

    resolveProvider() {

        switch (env.OTP_PROVIDER) {
    
            case "msg91":
                return Msg91Provider;
    
            case "twilio":
                return TwilioProvider;
    
            case "simpleverify":
                return SimpleVerifyProvider;
    
            default:
                return FakeProvider;
    
        }
    
    }

    name() {
        return this.provider.name?.() ?? "unknown";
    }

    async send(payload) {
        return this.provider.send(payload);
    }

    async verify(payload) {

        if (typeof this.provider.verify !== "function") {
            return true;
        }

        return this.provider.verify(payload);

    }

}

export default new OtpManager();