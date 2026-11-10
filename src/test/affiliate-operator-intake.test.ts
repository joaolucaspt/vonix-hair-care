import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { affiliateOperatorIntakeEnabled } from "@/lib/affiliate-applications.server";

const names = [
  "AFFILIATE_RECRUITMENT_OPEN",
  "AFFILIATE_GOVERNANCE_MIGRATED",
  "AFFILIATE_SUPABASE_URL",
  "AFFILIATE_SUPABASE_PROJECT_REF",
  "AFFILIATE_SUPABASE_SERVICE_ROLE_KEY",
  "AFFILIATE_TRAFFIC_PEPPER",
  "AFFILIATE_QUESTIONNAIRE_KEY",
  "AFFILIATE_TRUSTED_IP_HEADER",
] as const;
const old = new Map<string, string | undefined>();
beforeEach(() => {
  for (const name of names) old.set(name, process.env[name]);
  Object.assign(process.env, {
    AFFILIATE_RECRUITMENT_OPEN: "false",
    AFFILIATE_GOVERNANCE_MIGRATED: "true",
    AFFILIATE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    AFFILIATE_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    AFFILIATE_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_" + "A".repeat(48),
    AFFILIATE_TRAFFIC_PEPPER: "synthetic-test-pepper-".repeat(3),
    AFFILIATE_QUESTIONNAIRE_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString(
      "base64url",
    ),
    AFFILIATE_TRUSTED_IP_HEADER: "cf-connecting-ip",
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of names) {
    const value = old.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Vonix owner-controlled recruitment switch", () => {
  it("fails closed unless the private database confirms operator consent", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json([{ enabled: false, owner_acknowledged_at: null }]))
      .mockResolvedValueOnce(Response.json([{ enabled: true, owner_acknowledged_at: null }]))
      .mockResolvedValueOnce(
        Response.json([
          {
            enabled: true,
            owner_acknowledged_at: "2026-11-10T16:00:00+00:00",
          },
        ]),
      );
    vi.stubGlobal("fetch", request);
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    expect(await affiliateOperatorIntakeEnabled()).toBe(true);
    expect(request).toHaveBeenCalledTimes(3);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toContain("/vonix_affiliate_operator_intake?select=");
    expect(url).not.toContain("vonix_affiliate_applications");
    expect(options.redirect).toBe("manual");
    expect(options.headers.apikey).toMatch(/^sb_secret_/);
    expect(options.headers.authorization).toBeUndefined();
  });

  it("refuses operation when encryption, migration or traffic protection are missing", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    delete process.env["AFFILIATE_QUESTIONNAIRE_KEY"];
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    process.env["AFFILIATE_QUESTIONNAIRE_KEY"] = Buffer.from(
      "0123456789abcdef0123456789abcdef",
    ).toString("base64url");
    delete process.env["AFFILIATE_TRAFFIC_PEPPER"];
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    process.env["AFFILIATE_TRAFFIC_PEPPER"] = "synthetic-test-pepper-".repeat(3);
    delete process.env["AFFILIATE_GOVERNANCE_MIGRATED"];
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("refuses network failures and redirected responses without following them", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: "https://example.invalid" } }),
      );
    vi.stubGlobal("fetch", request);
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
    expect(await affiliateOperatorIntakeEnabled()).toBe(false);
  });
});
