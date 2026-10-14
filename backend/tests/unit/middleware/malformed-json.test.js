import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import errorMiddleware from "../../../src/middleware/error.middleware.js";

const app = express();
const handler = jest.fn((req, res) => res.json({ success: true }));
app.use(express.json());
app.post("/api/v1/auth/refresh", handler);
app.patch("/api/v1/users/me/profile", handler);
app.get("/unexpected", (req, res, next) => next(new SyntaxError("Internal error")));
app.use(errorMiddleware);

beforeEach(() => handler.mockClear());

test.each([
    ["post", "/api/v1/auth/refresh", '{"refreshToken":"private-value"'],
    ["patch", "/api/v1/users/me/profile", '{"displayName":"private-value"'],
])("malformed JSON on %s %s returns 400 before the handler", async (method, url, body) => {
    const response = await request(app)[method](url).set("Content-Type", "application/json").send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, code: "COMMON.VALIDATION_FAILED", message: "Request body must contain valid JSON.", details: null });
    expect(JSON.stringify(response.body)).not.toContain("private-value");
    expect(handler).not.toHaveBeenCalled();
});

test("valid JSON reaches the handler", async () => {
    const response = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "value" });
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
});

test("unrelated SyntaxError remains a server error", async () => {
    const response = await request(app).get("/unexpected");
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("COMMON.INTERNAL_SERVER_ERROR");
});
