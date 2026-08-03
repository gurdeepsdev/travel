import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Refresh Token", () => {

    it("should refresh access token", async () => {

        const auth = await TestAuth.login();

        const response = await request(app)

            .post("/api/v1/auth/refresh")

            .send({

                refreshToken: auth.refreshToken

            });

        expect(response.statusCode).toBe(200);

        expect(response.body.success).toBe(true);

        expect(response.body.data.tokens).toBeDefined();

        expect(response.body.data.tokens.accessToken).toBeDefined();

        expect(response.body.data.tokens.refreshToken).toBeDefined();

    });

});