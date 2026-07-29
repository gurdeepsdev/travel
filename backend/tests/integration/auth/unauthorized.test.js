import request from "supertest";

import app from "../../helpers/app.js";

describe("Authentication - Unauthorized Requests", () => {

    test("GET /auth/me", async () => {

        const response = await request(app)
            .get("/api/v1/auth/me");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("GET /auth/sessions", async () => {

        const response = await request(app)
            .get("/api/v1/auth/sessions");

        expect(response.statusCode).toBe(401);

    });

    test("POST /auth/logout", async () => {

        const response = await request(app)
            .post("/api/v1/auth/logout");

        expect(response.statusCode).toBe(401);

    });

    test("POST /auth/logout-all", async () => {

        const response = await request(app)
            .post("/api/v1/auth/logout-all");

        expect(response.statusCode).toBe(401);

    });

    test("DELETE /auth/sessions/:id", async () => {

        const response = await request(app)
            .delete("/api/v1/auth/sessions/123");

        expect(response.statusCode).toBe(401);

    });

    test("should reject malformed bearer token", async () => {

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", "Bearer abc");

        expect(response.statusCode).toBe(401);

    });

});