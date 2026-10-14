import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from "../../../src/modules/auth/auth.validation.js";

describe.each([["send", sendOtpSchema], ["verify", verifyOtpSchema]])("%s OTP identifier validation", (_, schema) => {
    const parse = (provider, identifier) => schema.safeParse({ body: { provider, identifier, otp: "123456" } });
    test.each(["ABCDEF1234", "98765abc10", "user@example.com", "9876543210+", "98 76543210", "72178216449999", "+91987654321099", "+1234567890123456", "0000000000", "+999123456789"])("rejects invalid phone %s", identifier => {
        expect(parse("phone", identifier).success).toBe(false);
    });
    test.each(["9876543210", "+919876543210", "+12025550123", "+447911123456", "+61293744000"])("accepts phone %s", identifier => {
        expect(parse("phone", identifier).success).toBe(true);
    });
    test("requires an email identifier for the email provider", () => {
        expect(parse("email", "9876543210").success).toBe(false);
        expect(parse("email", "user@example.com").success).toBe(true);
    });
});

describe("Refresh token whitespace validation", () => {
    test.each([" token", "token ", "tok en", "token\n", "\ttoken", "   "])("rejects whitespace in %j", refreshToken => {
        expect(refreshTokenSchema.safeParse({ body: { refreshToken } }).success).toBe(false);
    });
    test("preserves an unchanged token", () => {
        const refreshToken = "header.payload.signature";
        expect(refreshTokenSchema.parse({ body: { refreshToken } }).body.refreshToken).toBe(refreshToken);
    });
});
