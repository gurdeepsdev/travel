import request from "supertest";

import app from "../../src/app.js";

const testCases = [
  {
    name: "Missing Authorization header",
    authorization: null,
    expectedStatus: 401,
    expectedCode: "AUTH.INVALID_ACCESS_TOKEN",
    expectedMessage: "Authorization header is required.",
  },
  {
    name: "Basic authentication scheme",
    authorization: "Basic abc123",
    expectedStatus: 401,
    expectedCode: "AUTH.INVALID_ACCESS_TOKEN",
    expectedMessage: "Authorization header must use the Bearer token scheme.",
  },
  {
    name: "Bearer scheme without token",
    authorization: "Bearer",
    expectedStatus: 401,
    expectedCode: "AUTH.INVALID_ACCESS_TOKEN",
    expectedMessage: "Authorization header must use the Bearer token scheme.",
  },
  {
    name: "Bearer scheme with too many values",
    authorization: "Bearer token extra-value",
    expectedStatus: 401,
    expectedCode: "AUTH.INVALID_ACCESS_TOKEN",
    expectedMessage: "Authorization header must use the Bearer token scheme.",
  },
  {
    name: "Unsupported token scheme",
    authorization: "Token abc123",
    expectedStatus: 401,
    expectedCode: "AUTH.INVALID_ACCESS_TOKEN",
    expectedMessage: "Authorization header must use the Bearer token scheme.",
  },
];

let passed = 0;

for (const testCase of testCases) {
  let testRequest = request(app)
    .get("/api/v1/users/me")
    .set("Accept", "application/json");

  if (testCase.authorization !== null) {
    testRequest = testRequest.set("Authorization", testCase.authorization);
  }

  const response = await testRequest;

  const assertions = {
    status: response.status === testCase.expectedStatus,
    success: response.body.success === false,
    code: response.body.code === testCase.expectedCode,
    message: response.body.message === testCase.expectedMessage,
    details: response.body.details === null,
    requestId:
      typeof response.body.requestId === "string" &&
      response.body.requestId.length > 0,
    timestamp:
      typeof response.body.timestamp === "string" &&
      !Number.isNaN(Date.parse(response.body.timestamp)),
  };

  const isValid = Object.values(assertions).every(Boolean);

  console.log("\n==================================================");
  console.log(`CASE: ${testCase.name}`);
  console.log("==================================================");
  console.log("Status:", response.status);
  console.dir(response.body, { depth: null });
  console.log("Assertions:", assertions);
  console.log("Result:", isValid ? "PASS" : "FAIL");

  if (!isValid) {
    process.exitCode = 1;
  } else {
    passed += 1;
  }
}

console.log("\n==================================================");
console.log(`SUMMARY: ${passed}/${testCases.length} cases passed`);
console.log("==================================================");

if (passed !== testCases.length) {
  throw new Error("One or more users/me authentication tests failed.");
}

console.log("Basic users/me authentication cases successful");
