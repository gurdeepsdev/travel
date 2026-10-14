import { createHash, timingSafeEqual } from "node:crypto";
import HashService from "./hash.js";

const prefix = "sha256:";

export function hashRefreshToken(token) {
  return prefix + createHash("sha256").update(token, "utf8").digest("hex");
}

export async function compareRefreshToken(token, storedHash) {
  if (typeof storedHash !== "string") return false;
  if (/^sha256:[0-9a-f]{64}$/.test(storedHash)) {
    const actual = Buffer.from(hashRefreshToken(token).slice(prefix.length), "hex");
    const expected = Buffer.from(storedHash.slice(prefix.length), "hex");
    return timingSafeEqual(actual, expected);
  }
  if (/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedHash)) {
    return HashService.compare(token, storedHash);
  }
  return false;
}
