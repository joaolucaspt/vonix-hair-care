import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  affiliateOperationalReadiness,
  affiliateRecruitmentOpen,
} from "@/lib/affiliate-applications.server";

const keys = [
  "AFFILIATE_RECRUITMENT_OPEN",
  "AFFILIATE_GOVERNANCE_MIGRATED",
  "AFFILIATE_PRIVACY_POLICY_APPROVED",
  "AFFILIATE_PROVIDER_VERIFIED",
  "AFFILIATE_SUPABASE_URL",
  "AFFILIATE_SUPABASE_PROJECT_REF",
  "AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AFFILIATE_TRAFFIC_PEPPER",
  "AFFILIATE_QUESTIONNAIRE_KEY",
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
    AFFILIATE_GOVERNANCE_MIGRATED: "true",
    AFFILIATE_PRIVACY_POLICY_APPROVED: "true",
    AFFILIATE_PROVIDER_VERIFIED: "true",
    AFFILIATE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    AFFILIATE_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: "synthetic-dedicated-test-role-key",
    AFFILIATE_TRAFFIC_PEPPER: "unit-test-hmac-pepper-longer-than-32-chars",
    AFFILIATE_QUESTIONNAIRE_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString(
      "base64url",
    ),
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
  it("reports recruitment as blocked in the admin checklist when launch is requested but encryption is not ready", async () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    delete process.env["AFFILIATE_QUESTIONNAIRE_KEY"];
    // No dedicated database request or real records in this test.
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    const status = await affiliateOperationalReadiness();
    expect(status.recruitmentOpen).toBe(false);
    expect(status.checks.find((check) => check.id === "launch")?.ok).toBe(false);
    expect(status.checks.find((check) => check.id === "encryption")?.ok).toBe(false);
  });

  it("admin readiness recognizes the same whitespace-tolerant TOTP secret format as the auth gate", async () => {
    process.env["AFFILIATE_ADMIN_TOTP_SECRET"] = "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ";
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    const status = await affiliateOperationalReadiness();
    expect(status.checks.find((check) => check.id === "totp")?.ok).toBe(true);
  });

  it("keeps recruitment closed by default even with secrets configured", () => {
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("only opens with explicit opt-in and a complete server-side configuration", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    // Sending decision e-mails is optional: receiving a candidature only
    // depends on verified database, privacy, authentication and anti-abuse.
    for (const setting of ["AFFILIATE_FROM_EMAIL", "RESEND_API_KEY", "AFFILIATE_WORKER_SECRET"]) {
      delete process.env[setting];
      expect(affiliateRecruitmentOpen()).toBe(true);
    }
  });
  it("requires a project-specific pin and forbids the checkout database", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    delete process.env["AFFILIATE_SUPABASE_PROJECT_REF"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_SUPABASE_PROJECT_REF"] = "abcdefghijklmnopqrst";
    process.env["SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });

  it("rejects partially configured dedicated DB instead of mixing credentials", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "wrong-other-database-key";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("rejects insecure or malformed service-role database URLs", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    for (const badUrl of [
      "http://abcdefghijklmnopqrst.supabase.co",
      "https://user:password@abcdefghijklmnopqrst.supabase.co",
      "https://abcdefghijklmnopqrst.supabase.co/unexpected-path",
      "https://abcdefghijklmnopqrst.supabase.co?apikey=unsafe",
      "https://abcdefghijklmnopqrst.supabase.co:8080",
      "javascript:alert(1)",
    ]) {
      process.env["AFFILIATE_SUPABASE_URL"] = badUrl;
      expect(affiliateRecruitmentOpen()).toBe(false);
    }
  });

  it("never falls back to the checkout database, even when both checkout credentials exist", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    process.env["SUPABASE_URL"] = "https://checkout-store.supabase.co";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "store-only-key-not-for-affiliates";
    expect(affiliateRecruitmentOpen()).toBe(true);

    delete process.env["AFFILIATE_SUPABASE_URL"];
    delete process.env["AFFILIATE_SUPABASE_SERVICE_ROLE_KEY"];
    expect(affiliateRecruitmentOpen()).toBe(false);

    process.env["AFFILIATE_SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
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

  it("keeps recruitment closed without an authenticated questionnaire encryption key", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    delete process.env["AFFILIATE_QUESTIONNAIRE_KEY"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_QUESTIONNAIRE_KEY"] = "short-unsafe-key";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("refuses PII collection without explicit legal, migration, and provider approvals", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    expect(affiliateRecruitmentOpen()).toBe(true);
    for (const setting of [
      "AFFILIATE_GOVERNANCE_MIGRATED",
      "AFFILIATE_PRIVACY_POLICY_APPROVED",
      "AFFILIATE_PROVIDER_VERIFIED",
    ]) {
      delete process.env[setting];
      expect(affiliateRecruitmentOpen()).toBe(false);
      process.env[setting] = "true";
      expect(affiliateRecruitmentOpen()).toBe(true);
    }
  });

  it("requires MFA before public launch even without NODE_ENV", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    delete process.env["NODE_ENV"];
    expect(affiliateRecruitmentOpen()).toBe(true);
    delete process.env["AFFILIATE_ADMIN_TOTP_SECRET"];
    expect(affiliateRecruitmentOpen()).toBe(false);
    process.env["AFFILIATE_ADMIN_TOTP_SECRET"] = "invalid";
    expect(affiliateRecruitmentOpen()).toBe(false);
  });
  it("refuses launch when rate limiting or administrative session lacks secrets", () => {
    process.env["AFFILIATE_RECRUITMENT_OPEN"] = "true";
    for (const key of ["AFFILIATE_TRAFFIC_PEPPER", "AFFILIATE_ADMIN_SESSION_SECRET"]) {
      const saved = process.env[key]!;
      process.env[key] = "short";
      expect(affiliateRecruitmentOpen()).toBe(false);
      process.env[key] = saved;
    }
    expect(affiliateRecruitmentOpen()).toBe(true);
  });
});
