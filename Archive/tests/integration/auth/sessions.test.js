import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Sessions", () => {

    test("should return all active sessions", async () => {

        const auth = await TestAuth.login();

        const response = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);

        expect(Array.isArray(response.body.data.sessions)).toBe(true);

        expect(response.body.data.sessions.length).toBeGreaterThan(0);

    });

    test("returned session should contain required fields", async () => {

        const auth = await TestAuth.login();

        const response = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        const session = response.body.data.sessions[0];

        expect(session).toHaveProperty("id");
        expect(session).toHaveProperty("deviceName");
        expect(session).toHaveProperty("deviceType");
        expect(session).toHaveProperty("ipAddress");
        expect(session).toHaveProperty("userAgent");
        expect(session).toHaveProperty("createdAt");
        expect(session).toHaveProperty("expiresAt");

    });

});