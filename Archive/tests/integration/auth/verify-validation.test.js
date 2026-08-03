import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Verify OTP Validation", () => {

    test("should reject missing otp", async () => {

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject missing provider", async () => {

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                identifier: "9876543210",
                otp: "123456"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject missing identifier", async () => {

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                otp: "123456"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject invalid otp", async () => {

        const response = await request(app)
            .post("/api/v1/auth/verify-otp")
            .send({
                provider: "phone",
                identifier: "9876543210",
                otp: "111"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

});