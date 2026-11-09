import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { affiliateRecruitmentOpen } from "@/lib/affiliate-applications.server";

const keys = [
  "AFFILIATE_RECRUITMENT_OPEN",
  "AFFILIATE_SUPABASE_URL",
  "AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AFFILIATE_TRAFFIC_PEPPER",
  "AFFILIATE_TRUSTED_IP_HEADER",
  "AFFILIATE_ADMIN_PASSWORD",
  "AFFILIATE_ADMIN_SESSION_SECRET",
  "AFFILIATE_ADMIN_TOTP_SECRET",
  "AFFILIATE_WORKER_SECRET",
  "RESEND_API_KEY",
  "AFFILIATE_FROM_EMAIL",
  "NODE_ENV",
] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of keys) original[key] = process.env[key];
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    AFFILIATE_SUPABASE_URL: "https://example.supabase.co",
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
    AFFILIATE_TRAFFIC_PEPPER: "unit-test-hmac-pepper-longer-than-32-chars",
    AFFILIATE_TRUSTED_IP_HEADER: "cf-connecting-ip",
    AFFILIATE_ADMIN_PASSWORD: "unit-test-long-enough-password",
    AFFILIATE_ADMIN_SESSION_SECRET: "unit-test-session-key-longer-than-32-characters",
    AFFILIATE_ADMIN_TOTP_SECRET: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    AFFILIATE_WORKER_SECRET: "unit-test-worker-key-longer-than-24",
    RESEND_API_KEY: "resend-test-key",
    AFFILIATE_FROM_EMAIL: "afiliados@example.invalid",
    NODE_ENV: "production",
  });
});
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});
describe("Public affiliate launch gate", () => {
  it("keeps recruitment closed by default even with secrets configured", () => {
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("only opens with explicit opt-in and a complete server-side configuration", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    process.env["AFFILIATE_FROM_EMAIL"] = "";
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_FROM_EMAIL"] = "afiliados@example.invalid";
    expect(affiliateRecruitmentOpen()).toBe(true);
  });
  it("rejects partially configured dedicated DB instead of mixing credentials", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "wrong-other-database-key";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("requires an explicit trusted proxy header before opening registration", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    delete process.env["AFFILIATE_TRUSTED_IP_HEADER"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "accept-anything";
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_TRUSTED_IP_HEADER"] = "x-real-ip";
    expect(affiliateRecruitmentOpen()).toBe(true);
  });

  it("requires MFA before public launch in production", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    delete process.env["AFFILIATE_ADMIN_TOTP_SECRET"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_ADMIN_TOTP_SECRET"] = "invalid";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("refuses launch when rate limiting, administrative session or worker lacks secrets", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    for (const key of [
      "AFFILIATE_TRAFFIC_PEPPER",
      "AFFILIATE_ADMIN_SESSION_SECRET",
      "AFFILIATE_WORKER_SECRET",
    ]) {
      const saved = process.env[key]!;
      process.env[key] = "short";
      expect(affiliateRecruitmentOpen()).toBe(false);
      process.env[key] = saved;
    }
    expect(affiliateRecruitmentOpen()).toBe(true);
  });
});
