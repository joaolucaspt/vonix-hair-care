import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  sameOrigin: vi.fn(),
  validTotp: vi.fn(),
  createSession: vi.fn(),
  validPassword: vi.fn(),
  allowed: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/lib/affiliate-admin-session.server", () => ({
  affiliateAdminSameOrigin: auth.sameOrigin,
  affiliateAdminSecondFactorValid: auth.validTotp,
  createAffiliateAdminSession: auth.createSession,
}));
vi.mock("@/lib/affiliate-applications.server", () => ({
  affiliateAdminAuthorized: auth.validPassword,
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: auth.allowed,
  consumeAffiliateRateLimit: auth.consume,
}));

import { attemptAffiliateAdminLogin } from "@/lib/affiliate-admin-auth.server";

beforeEach(() => {
  vi.resetAllMocks();
  auth.sameOrigin.mockReturnValue(true);
  auth.validTotp.mockReturnValue(true);
  auth.validPassword.mockReturnValue(true);
  auth.createSession.mockReturnValue(true);
  auth.allowed.mockResolvedValue(true);
  auth.consume.mockResolvedValue(true);
});

describe("Vonix affiliate admin login failure quota", () => {
  it("authenticates with correct password and MFA without consuming a failed-attempt quota", async () => {
    expect(await attemptAffiliateAdminLogin("valid-pass", "123456")).toEqual({ ok: true });
    expect(auth.allowed).toHaveBeenCalledOnce();
    expect(auth.consume).not.toHaveBeenCalled();
    expect(auth.createSession).toHaveBeenCalledOnce();
  });

  it("counts bad password but never issues a session", async () => {
    auth.validPassword.mockReturnValue(false);
    const result = await attemptAffiliateAdminLogin("bad-pass", "123456");
    expect(result).toMatchObject({ ok: false });
    expect(result).not.toEqual({ ok: true });
    expect(auth.consume).toHaveBeenCalledWith("admin");
    expect(auth.createSession).not.toHaveBeenCalled();
    expect(auth.validTotp).toHaveBeenCalledOnce();
  });

  it("counts bad second factor exactly once even with valid password", async () => {
    auth.validTotp.mockReturnValue(false);
    expect(await attemptAffiliateAdminLogin("valid-pass", "000000")).toMatchObject({ ok: false });
    expect(auth.consume).toHaveBeenCalledTimes(1);
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("blocks known locked-out IPs before validating credentials, including correct credentials", async () => {
    auth.allowed.mockResolvedValue(false);
    expect(await attemptAffiliateAdminLogin("valid-pass", "123456")).toMatchObject({ ok: false });
    expect(auth.validPassword).not.toHaveBeenCalled();
    expect(auth.validTotp).not.toHaveBeenCalled();
    expect(auth.consume).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("rejects untrusted origins without touching rate limit storage", async () => {
    auth.sameOrigin.mockReturnValue(false);
    expect(await attemptAffiliateAdminLogin("valid-pass", "123456")).toMatchObject({ ok: false });
    expect(auth.allowed).not.toHaveBeenCalled();
    expect(auth.consume).not.toHaveBeenCalled();
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("fails closed on database quota outage and never issues sessions", async () => {
    auth.allowed.mockRejectedValue(new Error("unavailable"));
    expect(await attemptAffiliateAdminLogin("valid-pass", "123456")).toMatchObject({ ok: false });
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("fails closed when counting an incorrect login cannot be saved", async () => {
    auth.validPassword.mockReturnValue(false);
    auth.consume.mockRejectedValue(new Error("network"));
    expect(await attemptAffiliateAdminLogin("bad-pass", "000000")).toMatchObject({ ok: false });
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("stops at the durable failure threshold and avoids revealing which factor failed", async () => {
    auth.validPassword.mockReturnValue(false);
    auth.consume.mockResolvedValue(false);
    const response = await attemptAffiliateAdminLogin("bad-pass", "123456");
    expect(response).toEqual({
      ok: false,
      reason: "Acesso indisponível. Verifique as configurações e tente mais tarde.",
    });
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("cannot report login success when cookie creation is not configured", async () => {
    auth.createSession.mockReturnValue(false);
    expect(await attemptAffiliateAdminLogin("valid-pass", "123456")).toMatchObject({ ok: false });
    expect(auth.consume).not.toHaveBeenCalled();
  });
});
