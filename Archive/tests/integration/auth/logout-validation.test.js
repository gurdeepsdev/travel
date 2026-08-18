import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Logout Validation", () => {

    test("should reject logout without authorization", async () => {

        const response = await request(app)
            .post("/api/v1/auth/logout");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject logout-all without authorization", async () => {

        const response = await request(app)
            .post("/api/v1/auth/logout-all");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject malformed bearer token", async () => {

        const response = await request(app)
            .post("/api/v1/auth/logout")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

});