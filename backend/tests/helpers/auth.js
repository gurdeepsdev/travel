import request from "supertest";

import app from "./app.js";

import FakeOtpProvider from "../../src/providers/otp/fake.provider.js";

import { users } from "../fixtures/users.js";

class TestAuth {

    async login() {

        await request(app)
        .post("/api/v1/auth/send-otp")
        .send(users.phoneUser);
    
    const otp = FakeOtpProvider.getLatestOtp(users.phoneUser.identifier);
    
    console.log("TEST OTP:", otp);
    
    const response = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
            ...users.phoneUser,
            otp
        });
    
    console.log("LOGIN RESPONSE");
    console.dir(response.body, { depth: null });
    
    return {
        accessToken: response.body.data.accessToken,
        refreshToken: response.body.data.refreshToken,
        user: response.body.data.user,
        session: response.body.data.session
    };

    }

}

export default new TestAuth();