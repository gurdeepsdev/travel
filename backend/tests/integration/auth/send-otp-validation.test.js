import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Send OTP Validation", () => {

    test("should reject missing provider", async () => {

        const response = await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                identifier: "9876543210"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject missing identifier", async () => {

        const response = await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "phone"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject invalid provider", async () => {

        const response = await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "sms",
                identifier: "9876543210"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject invalid phone", async () => {

        const response = await request(app)
            .post("/api/v1/auth/send-otp")
            .send({
                provider: "phone",
                identifier: "123"
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

});