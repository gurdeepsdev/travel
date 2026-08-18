import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Refresh Validation", () => {

    test("should reject missing refresh token", async () => {

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({});

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

    test("should reject empty refresh token", async () => {

        const response = await request(app)
            .post("/api/v1/auth/refresh")
            .send({
                refreshToken: ""
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);

    });

});