import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Expired Session", () => {

    test("should reject access after logout", async () => {

        const auth = await TestAuth.login();

        await request(app)
            .post("/api/v1/auth/logout")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${auth.accessToken}`);

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);

    });

    test("should reject refresh after logout", async () => {

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