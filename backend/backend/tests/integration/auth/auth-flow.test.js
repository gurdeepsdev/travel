import request from "supertest";

import app from "../../helpers/app.js";
import FakeOtpProvider from "../../../src/providers/otp/fake.provider.js";

describe("Complete Authentication Flow", () => {

    test("should complete entire auth lifecycle", async () => {

        await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "phone",
                identifier: "9876543210"
            });

            const otp = FakeOtpProvider.getLatestOtp("9876543210");
        const login = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp
            });

        expect(login.statusCode).toBe(200);

        const accessToken = login.body.data.accessToken;
        const refreshToken = login.body.data.refreshToken;

        const me = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(me.statusCode).toBe(200);

        const refresh = await request(app)
            .post("/api/v1/auth/refresh")
            .send({
                refreshToken
            });

        expect(refresh.statusCode).toBe(200);

        const logout = await request(app)
            .post("/api/v1/auth/logout")
            .set(
                "Authorization",
                `Bearer ${refresh.body.data.tokens.accessToken}`
            );

        expect(logout.statusCode).toBe(200);

        const denied = await request(app)
            .get("/api/v1/auth/me")
            .set(
                "Authorization",
                `Bearer ${refresh.body.data.tokens.accessToken}`
            );

        expect(denied.statusCode).toBe(401);

    });

});