import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieApi = vi.hoisted(() => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  getRequest: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => cookieApi);

import {
  affiliateAdminOriginAllowed,
  affiliateMutationSameOrigin,
  affiliateAdminSecondFactorValid,
  affiliateAdminSessionValid,
  createAffiliateAdminSession,
  createAffiliateSessionToken,
  destroyAffiliateAdminSession,
  verifyAffiliateSessionToken,
  verifyAffiliateTotp,
} from "@/lib/affiliate-admin-session.server";

const KEY = createHash("sha256").update("unit-test-only-key").digest();
const OTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of [
    "AFFILIATE_ADMIN_SESSION_SECRET",
    "AFFILIATE_ADMIN_PASSWORD",
    "AFFILIATE_ADMIN_TOTP_SECRET",
    "NODE_ENV",
  ]) {
    saved[key] = process.env[key];
  }
  process.env["AFFILIATE_ADMIN_SESSION_SECRET"] = "unit-session-secret-min-32-characters-2026";
  process.env["AFFILIATE_ADMIN_PASSWORD"] = "unit-long-admin-password";
  process.env["AFFILIATE_ADMIN_TOTP_SECRET"] = OTP_SECRET;
  process.env["NODE_ENV"] = "test";
  vi.resetAllMocks();
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.useRealTimers();
});

describe("Vonix affiliate admin session", () => {
  it("signs an opaque two-hour token and rejects expiration, future and tampering", () => {
    const now = 2_000_000_000_000;
    const token = createAffiliateSessionToken(KEY, now);
    expect(verifyAffiliateSessionToken(token, KEY, now)).toBe(true);
    expect(verifyAffiliateSessionToken(token, KEY, now + 7_199_999)).toBe(true);
    expect(verifyAffiliateSessionToken(token, KEY, now + 7_200_000)).toBe(false);
    expect(verifyAffiliateSessionToken(token, KEY, now - 6_000)).toBe(false);
    expect(verifyAffiliateSessionToken(token, Buffer.alloc(32), now)).toBe(false);
    expect(verifyAffiliateSessionToken(token.slice(0, -1) + "!", KEY, now)).toBe(false);
    expect(verifyAffiliateSessionToken("v1.fake", KEY, now)).toBe(false);
    expect(verifyAffiliateSessionToken(null, KEY, now)).toBe(false);
    expect(token).not.toContain("unit-long-admin-password");
  });

  it("uses cookie flags and removes the token on logout", () => {
    cookieApi.getRequest.mockReturnValue({ url: "http://localhost:43919/admin/afiliadas" });
    expect(createAffiliateAdminSession()).toBe(true);
    const [name, token, options] = cookieApi.setCookie.mock.calls[0]!;
    expect(name).toBe("vonix-affiliates-admin-dev");
    expect(typeof token).toBe("string");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/", maxAge: 7200 });
    cookieApi.getCookie.mockReturnValue(token);
    expect(affiliateAdminSessionValid()).toBe(true);
    process.env["AFFILIATE_ADMIN_PASSWORD"] = "rotated-unit-long-admin-password";
    expect(affiliateAdminSessionValid()).toBe(false);
    destroyAffiliateAdminSession();
    expect(cookieApi.deleteCookie).toHaveBeenCalledWith(
      "vonix-affiliates-admin-dev",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }),
    );
  });

  it("never allows missing TOTP, even when NODE_ENV is unset or development", () => {
    delete process.env["AFFILIATE_ADMIN_TOTP_SECRET"];
    for (const mode of [undefined, "development", "production"]) {
      if (mode) process.env["NODE_ENV"] = mode;
      else delete process.env["NODE_ENV"];
      expect(affiliateAdminSecondFactorValid("")).toBe(false);
      expect(affiliateAdminSecondFactorValid("123456")).toBe(false);
      expect(createAffiliateAdminSession()).toBe(false);
    }
    expect(cookieApi.setCookie).not.toHaveBeenCalled();
  });

  it("forces secure __Host cookies on a hosted domain despite missing NODE_ENV", () => {
    cookieApi.getRequest.mockReturnValue({ url: "https://vonixhair.com/admin/afiliadas" });
    for (const mode of [undefined, "development", "production"]) {
      if (mode) process.env["NODE_ENV"] = mode;
      else delete process.env["NODE_ENV"];
      expect(createAffiliateAdminSession()).toBe(true);
      const [name, token, attributes] = cookieApi.setCookie.mock.calls.at(-1)!;
      expect(name).toBe("__Host-vonix-affiliates-admin");
      expect(typeof token).toBe("string");
      expect(attributes).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
      });
      destroyAffiliateAdminSession();
      expect(cookieApi.deleteCookie).toHaveBeenLastCalledWith(
        "__Host-vonix-affiliates-admin",
        expect.objectContaining({ secure: true }),
      );
    }
  });

  it("uses Secure host-only cookies without a trustworthy request context", () => {
    delete process.env["NODE_ENV"];
    expect(createAffiliateAdminSession()).toBe(true);
    expect(cookieApi.setCookie).toHaveBeenLastCalledWith(
      "__Host-vonix-affiliates-admin",
      expect.any(String),
      expect.objectContaining({ secure: true, httpOnly: true, path: "/" }),
    );
  });

  it("invalidates an existing cookie immediately when the OTP factor is removed", () => {
    expect(createAffiliateAdminSession()).toBe(true);
    const token = cookieApi.setCookie.mock.calls[0]![1];
    cookieApi.getCookie.mockReturnValue(token);
    expect(affiliateAdminSessionValid()).toBe(true);
    delete process.env["AFFILIATE_ADMIN_TOTP_SECRET"];
    expect(affiliateAdminSessionValid()).toBe(false);
  });

  it("permits a nonsecure development cookie only for localhost HTTP", () => {
    process.env["NODE_ENV"] = "development";
    cookieApi.getRequest.mockReturnValue({ url: "http://127.0.0.1:43922/admin/afiliadas" });
    expect(createAffiliateAdminSession()).toBe(true);
    expect(cookieApi.setCookie).toHaveBeenLastCalledWith(
      "vonix-affiliates-admin-dev",
      expect.any(String),
      expect.objectContaining({ secure: false, httpOnly: true, sameSite: "strict" }),
    );
  });

  it("does not mint a session without sufficiently strong configuration", () => {
    process.env["AFFILIATE_ADMIN_SESSION_SECRET"] = "weak";
    expect(createAffiliateAdminSession()).toBe(false);
    expect(cookieApi.setCookie).not.toHaveBeenCalled();
    expect(affiliateAdminSessionValid()).toBe(false);
  });
});

describe("Vonix affiliate admin second factor", () => {
  it("validates RFC 6238 TOTP SHA1 6-digit values with bounded time skew", () => {
    expect(verifyAffiliateTotp("287082", OTP_SECRET, 59_000)).toBe(true);
    expect(verifyAffiliateTotp("287082", OTP_SECRET, 59_000 + 30_000)).toBe(true);
    expect(verifyAffiliateTotp("287082", OTP_SECRET, 59_000 + 60_000)).toBe(false);
    expect(verifyAffiliateTotp("12345", OTP_SECRET, 59_000)).toBe(false);
    expect(verifyAffiliateTotp("287082", "not-base32", 59_000)).toBe(false);
  });

  it("requires an exact 6-digit MFA code when configured", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));
    expect(affiliateAdminSecondFactorValid("287082")).toBe(true);
    expect(affiliateAdminSecondFactorValid("000000")).toBe(false);
    expect(affiliateAdminSecondFactorValid("")).toBe(false);
  });
});

describe("Cross-site request safety", () => {
  it("fails closed without request metadata and rejects forged public origins", () => {
    expect(affiliateMutationSameOrigin()).toBe(false);
    cookieApi.getRequest.mockReturnValue({
      url: "https://vonixhair.com/api/affiliate",
      headers: new Headers({ origin: "https://evil.example.com" }),
    });
    expect(affiliateMutationSameOrigin()).toBe(false);
    cookieApi.getRequest.mockReturnValue({
      url: "https://vonixhair.com/api/affiliate",
      headers: new Headers({ origin: "https://vonixhair.com" }),
    });
    expect(affiliateMutationSameOrigin()).toBe(true);
    cookieApi.getRequest.mockReturnValue({
      url: "https://vonixhair.com/api/affiliate",
      headers: new Headers(),
    });
    expect(affiliateMutationSameOrigin()).toBe(false);
  });

  it("allows same-origin HTTPS and local development, rejects cross-site requests", () => {
    expect(
      affiliateAdminOriginAllowed(
        "https://shop.example.com",
        "https://shop.example.com/api/_serverfn",
      ),
    ).toBe(true);
    expect(
      affiliateAdminOriginAllowed("http://127.0.0.1:43919", "http://127.0.0.1:43919/entry"),
    ).toBe(true);
    expect(
      affiliateAdminOriginAllowed("https://evil.example.com", "https://shop.example.com/api"),
    ).toBe(false);
    expect(
      affiliateAdminOriginAllowed("http://shop.example.com", "https://shop.example.com/api"),
    ).toBe(false);
    expect(affiliateAdminOriginAllowed(null, "https://shop.example.com/api")).toBe(false);
    expect(
      affiliateAdminOriginAllowed("http://shop.example.com", "http://shop.example.com/api"),
    ).toBe(false);
  });
});
