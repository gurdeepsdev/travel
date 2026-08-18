import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Logout All", () => {

    test("should logout all sessions", async () => {

        const session1 = await TestAuth.login();
        const session2 = await TestAuth.login();

        const logoutResponse = await request(app)
            .post("/api/v1/auth/logout-all")
            .set("Authorization", `Bearer ${session1.accessToken}`);

        expect(logoutResponse.statusCode).toBe(200);
        expect(logoutResponse.body.success).toBe(true);

        const me1 = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${session1.accessToken}`);

        expect(me1.statusCode).toBe(401);

        const me2 = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${session2.accessToken}`);

        expect(me2.statusCode).toBe(401);

    });

});