import bcrypt from "bcrypt";
import { hashRefreshToken, compareRefreshToken } from "../../../src/core/security/refresh-token-hash.js";

test("new refresh digests verify the full token including bytes beyond bcrypt's 72-byte limit", async () => {
  const token = "a".repeat(100) + ".signature";
  const digest = hashRefreshToken(token);
  expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(await compareRefreshToken(token, digest)).toBe(true);
  expect(await compareRefreshToken("a".repeat(100) + ".modified", digest)).toBe(false);
});

test("existing bcrypt refresh hashes remain valid and can be replaced by SHA-256", async () => {
  const token = "legacy-refresh-token";
  const legacy = await bcrypt.hash(token, 4);
  expect(await compareRefreshToken(token, legacy)).toBe(true);
  expect(await compareRefreshToken("wrong-token", legacy)).toBe(false);
  expect(await compareRefreshToken(token, hashRefreshToken(token))).toBe(true);
});

test.each([null, undefined, "", "sha256:bad", "sha256:" + "g".repeat(64), "$2b$12$broken"])("malformed stored hash fails closed: %s", async stored => {
  expect(await compareRefreshToken("token", stored)).toBe(false);
});
