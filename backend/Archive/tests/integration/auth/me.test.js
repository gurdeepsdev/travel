import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Me", () => {

    it("should return current authenticated user", async () => {

        const auth = await TestAuth.login();

        const response = await request(app)

            .get("/api/v1/auth/me")

            .set(
                "Authorization",
                `Bearer ${auth.accessToken}`
            );

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);

        expect(response.body.data.viewer).toBeDefined();

        expect(response.body.data.viewer.id).toBe(auth.user.id);

    });

});