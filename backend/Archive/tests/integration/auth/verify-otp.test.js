import request from "supertest";

import app from "../../helpers/app.js";
import FakeOtpProvider from "../../../src/providers/otp/fake.provider.js";
import { users } from "../../fixtures/users.js";

describe("Authentication - Verify OTP", () => {

    beforeEach(() => {
        FakeOtpProvider.clear();
    });

    it("should verify OTP and login successfully", async () => {

        await request(app)
            .post("/api/v1/auth/send-otp")
            .send(users.phoneUser);

        const otp = FakeOtpProvider.getLatestOtp(
            users.phoneUser.identifier
        );

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                ...users.phoneUser,
                otp
            });

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);

        expect(response.body.data.user).toBeDefined();

        expect(response.body.data.session).toBeDefined();

        expect(response.body.data.accessToken).toBeDefined();

        expect(response.body.data.refreshToken).toBeDefined();

    });

});