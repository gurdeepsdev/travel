import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Send OTP", () => {

    test("should send OTP successfully", async () => {

        const response = await request(app)

            .post("/api/v1/auth/send-otp")

            .send({

                provider: "phone",

                identifier: "9876543210"

            });

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);

        expect(response.body.data.provider).toBe("phone");

        expect(response.body.data.identifier).toBe("9876543210");

        expect(response.body.data).toHaveProperty("expiresAt");

    });

});