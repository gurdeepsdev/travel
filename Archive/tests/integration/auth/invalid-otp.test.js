import request from "supertest";

import app from "../../helpers/app.js";
import FakeOtpProvider from "../../../src/providers/otp/fake.provider.js";

describe("Authentication - Invalid OTP", () => {

    beforeEach(() => {
        FakeOtpProvider.clear();
    });

    test("should reject incorrect otp", async () => {

        await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "phone",
                identifier: "9876543210"
            });

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp: "111111"
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject random otp", async () => {

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp: "999999"
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject reused otp", async () => {

        await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "phone",
                identifier: "9876543210"
            });

        const otp = FakeOtpProvider.getLatestOtp("9876543210");

        expect(otp).toBeDefined();

        const login = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp
            });

        expect(login.status).toBe(200);

        const reused = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp
            });

        expect(reused.status).toBe(401);
        expect(reused.body.success).toBe(false);

    });

});