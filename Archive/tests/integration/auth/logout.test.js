import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Logout", () => {

    test("should logout current session", async () => {

        const auth = await TestAuth.login();

        const logoutResponse = await request(app)
            .post("/api/v1/auth/logout")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        expect(logoutResponse.statusCode).toBe(200);
        expect(logoutResponse.body.success).toBe(true);

        const meResponse = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        expect(meResponse.statusCode).toBe(401);
        expect(meResponse.body.success).toBe(false);

    });

});