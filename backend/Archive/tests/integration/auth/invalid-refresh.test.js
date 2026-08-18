import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Invalid Refresh Token", () => {

    test("should reject fake refresh token", async () => {

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({
                refreshToken: "fake-token"
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject access token as refresh token", async () => {

        const auth = await TestAuth.login();

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({
                refreshToken: auth.accessToken
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject revoked refresh token", async () => {

        const auth = await TestAuth.login();

        await request(app)
            .post("/api/v1/auth/logout")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({
                refreshToken: auth.refreshToken
            });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

});