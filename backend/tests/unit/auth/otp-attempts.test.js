import { jest } from "@jest/globals";
const repository = { findActive: jest.fn(), incrementAttempts: jest.fn(), markVerified: jest.fn() };
const hash = { compare: jest.fn() };
jest.unstable_mockModule("../../../src/modules/auth/repositories/otp.repository.js", () => ({ default: repository }));
jest.unstable_mockModule("../../../src/core/security/hash.js", () => ({ default: hash }));
jest.unstable_mockModule("../../../src/providers/otp/otp-manager.js", () => ({ default: { name: () => "fake" } }));
jest.unstable_mockModule("../../../src/config/security.js", () => ({ default: { otp: { maxAttempts: 5 } } }));
const { default: service } = await import("../../../src/modules/auth/services/otp.service.js");
beforeEach(() => jest.resetAllMocks());
test("correct OTP cannot bypass exhausted attempts", async () => {
    repository.findActive.mockResolvedValue({ id: "otp", attempt_count: 5 });
    hash.compare.mockResolvedValue(true);
    await expect(service.verify({ provider: "phone", identifier: "9876543210", otp: "123456" })).rejects.toThrow();
    expect(hash.compare).not.toHaveBeenCalled();
    expect(repository.markVerified).not.toHaveBeenCalled();
});
test("incorrect OTP increments attempts without consuming the challenge", async () => {
    repository.findActive.mockResolvedValue({ id: "otp", attempt_count: 4, otp_hash: "hash" });
    hash.compare.mockResolvedValue(false);
    await expect(service.verify({ provider: "phone", identifier: "9876543210", otp: "654321" })).rejects.toThrow();
    expect(repository.incrementAttempts).toHaveBeenCalledWith("otp");
    expect(repository.markVerified).not.toHaveBeenCalled();
});
test("correct OTP within the limit consumes the challenge", async () => {
    repository.findActive.mockResolvedValue({ id: "otp", attempt_count: 4, otp_hash: "hash" });
    hash.compare.mockResolvedValue(true);
    await service.verify({ provider: "phone", identifier: "9876543210", otp: "123456" });
    expect(repository.markVerified).toHaveBeenCalledWith("otp");
});
