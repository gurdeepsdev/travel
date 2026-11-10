import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const userId = "11111111-1111-4111-8111-111111111111";
const languageId = "22222222-2222-4222-8222-222222222222";
const itineraryId = "33333333-3333-4333-8333-333333333333";
const lessonId = "44444444-4444-4444-8444-444444444444";
const attemptId = "55555555-5555-4555-8555-555555555555";
const questionId = "66666666-6666-4666-8666-666666666666";
const optionId = "77777777-7777-4777-8777-777777777777";

const serviceMock = {
  listLanguages: jest.fn(),
  setItineraryLanguage: jest.fn(),
  resetItineraryLanguage: jest.fn(),
  listLessons: jest.fn(),
  getLessonCards: jest.fn(),
  startAttempt: jest.fn(),
  getAttempt: jest.fn(),
  submitAnswer: jest.fn(),
  finishAttempt: jest.fn(),
  getResult: jest.fn(),
  reviewAttempt: jest.fn(),
  getProgress: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/lingua/lingua.service.js",
  () => ({ default: serviceMock }),
);

jest.unstable_mockModule(
  "../../../src/middleware/auth.middleware.js",
  () => ({
    default: {
      authenticate(req, res, next) {
        if (req.get("Authorization") !== "Bearer test-token") {
          return res.status(401).json({ success: false });
        }
        req.user = { id: userId };
        return next();
      },
    },
  }),
);

const { default: linguaRoutes } = await import(
  "../../../src/modules/lingua/lingua.routes.js"
);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.context = { requestId: "88888888-8888-4888-8888-888888888888" };
  next();
});
app.use("/api/v1/lingua", linguaRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  return res.status(error.statusCode ?? 500).json({
    success: false,
    code: error.code,
  });
});

const authorization = { Authorization: "Bearer test-token" };

describe("LinguaTrail HTTP routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of Object.values(serviceMock)) {
      method.mockResolvedValue({});
    }
    serviceMock.startAttempt.mockResolvedValue({ created: true });
  });

  test("requires authentication", async () => {
    const response = await request(app).get("/api/v1/lingua/languages");
    expect(response.status).toBe(401);
    expect(serviceMock.listLanguages).not.toHaveBeenCalled();
  });

  test.each([
    ["get", "/api/v1/lingua/languages", null, 200, "listLanguages"],
    ["get", `/api/v1/lingua/languages?itineraryId=${itineraryId}`, null, 200, "listLanguages"],
    ["get", `/api/v1/lingua/progress?languageId=${languageId}`, null, 200, "getProgress"],
    ["get", `/api/v1/lingua/languages/${languageId}/lessons`, null, 200, "listLessons"],
    ["get", `/api/v1/lingua/lessons/${lessonId}/cards`, null, 200, "getLessonCards"],
    ["post", `/api/v1/lingua/lessons/${lessonId}/attempts`, {}, 201, "startAttempt"],
    ["get", `/api/v1/lingua/attempts/${attemptId}`, null, 200, "getAttempt"],
    ["post", `/api/v1/lingua/attempts/${attemptId}/questions/${questionId}/answers`, {
      optionId,
      mode: "QUIZ",
    }, 200, "submitAnswer"],
    ["post", `/api/v1/lingua/attempts/${attemptId}/finish`, null, 200, "finishAttempt"],
    ["get", `/api/v1/lingua/attempts/${attemptId}/result`, null, 200, "getResult"],
    ["get", `/api/v1/lingua/attempts/${attemptId}/review`, null, 200, "reviewAttempt"],
    ["put", `/api/v1/lingua/itineraries/${itineraryId}/language`, {
      languageId,
    }, 200, "setItineraryLanguage"],
    ["delete", `/api/v1/lingua/itineraries/${itineraryId}/language`, null, 200, "resetItineraryLanguage"],
  ])("%s %s", async (method, url, body, status, serviceMethod) => {
    let operation = request(app)[method](url).set(authorization);
    if (body !== null) operation = operation.send(body);

    const response = await operation;

    expect(response.status).toBe(status);
    expect(response.body.success).toBe(true);
    expect(serviceMock[serviceMethod]).toHaveBeenCalledTimes(1);
  });

  test("validates answer ownership identifiers before service execution", async () => {
    const response = await request(app)
      .post(`/api/v1/lingua/attempts/${attemptId}/questions/${questionId}/answers`)
      .set(authorization)
      .send({ optionId: "not-a-uuid", mode: "QUIZ" });

    expect(response.status).toBe(400);
    expect(serviceMock.submitAnswer).not.toHaveBeenCalled();
  });
});
