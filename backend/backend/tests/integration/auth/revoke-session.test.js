import request from "supertest";

import app from "../../helpers/app.js";
import TestAuth from "../../helpers/auth.js";

describe("Authentication - Revoke Session", () => {

    test("should revoke another session", async () => {

        const session1 = await TestAuth.login();
        await TestAuth.login();

        const sessionsResponse = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Authorization", `Bearer ${session1.accessToken}`);

        expect(sessionsResponse.statusCode).toBe(200);

        const sessions = sessionsResponse.body.data.sessions;

        expect(sessions.length).toBeGreaterThanOrEqual(2);

        const revokeTarget = sessions.find(
            s => s.id !== session1.session.id
        );

        expect(revokeTarget).toBeDefined();

        const revokeResponse = await request(app)
            .delete(`/api/v1/auth/sessions/${revokeTarget.id}`)
            .set("Authorization", `Bearer ${session1.accessToken}`);

        expect(revokeResponse.statusCode).toBe(200);
        expect(revokeResponse.body.success).toBe(true);

        const updated = await request(app)
            .get("/api/v1/auth/sessions")
            .set("Authorization", `Bearer ${session1.accessToken}`);

        expect(updated.body.data.sessions.length)
            .toBe(sessions.length - 1);

    });

});