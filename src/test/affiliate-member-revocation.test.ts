import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieApi = vi.hoisted(() => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  getRequest: vi.fn(),
}));
const member = vi.hoisted(() => ({
  affiliateMemberSession: vi.fn(),
  clearAffiliateMemberSession: vi.fn(),
}));
const database = vi.hoisted(() => ({ affiliateDatabaseConfig: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => cookieApi);
vi.mock("@/lib/affiliate-member-session.server", () => member);
vi.mock("@/lib/affiliate-database.server", () => database);

import {
  affiliateAdminSessionAuthorized,
  affiliateAdminSessionValid,
  createAffiliateAdminSession,
} from "@/lib/affiliate-admin-session.server";

const email = "active-owner@example.test";
const activatedAt = "2026-11-10T12:00:00+00:00";
const saved: Record<string, string | undefined> = {};

function reply(rows: unknown, status = 200) {
  return { ok: status === 200, status, json: vi.fn(async () => rows) };
}

beforeEach(() => {
  for (const name of [
    "AFFILIATE_ADMIN_SESSION_SECRET",
    "AFFILIATE_ADMIN_PASSWORD",
    "AFFILIATE_ADMIN_TOTP_SECRET",
    "NODE_ENV",
  ]) {
    saved[name] = process.env[name];
  }
  process.env["AFFILIATE_ADMIN_SESSION_SECRET"] = "unit-session-secret-min-32-characters-2026";
  process.env["AFFILIATE_ADMIN_PASSWORD"] = "unit-long-admin-password";
  process.env["AFFILIATE_ADMIN_TOTP_SECRET"] = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  process.env["NODE_ENV"] = "test";
  vi.clearAllMocks();
  cookieApi.getRequest.mockReturnValue({ url: "https://vonixhair.com/admin/afiliadas" });
  cookieApi.getCookie.mockReturnValue(null);
  member.affiliateMemberSession.mockReturnValue({ email, role: "owner" });
  database.affiliateDatabaseConfig.mockReturnValue({
    url: "https://dedicated-db.example.test",
    headers: { apikey: "synthetic-test-value" },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Affiliate admin current roster session revocation", () => {
  it("denies an owner whose membership was removed even though a signed member cookie remains valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply([])),
    );
    expect(affiliateAdminSessionValid()).toBe(true);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("denies owner downgraded to reviewer and reviewer promoted to owner until login again", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply([{ email, role: "reviewer", password_set_at: activatedAt }]))
      .mockResolvedValueOnce(reply([{ email, role: "owner", password_set_at: activatedAt }]));
    vi.stubGlobal("fetch", f);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
    member.affiliateMemberSession.mockReturnValue({ email, role: "reviewer" });
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });

  it("denies deactivated account, changed email, malformed rows and duplicate rows", async () => {
    const responses = [
      [{ email, role: "owner", password_set_at: null }],
      [{ email: "other@example.test", role: "owner", password_set_at: activatedAt }],
      [{ email, role: "administrator", password_set_at: activatedAt }],
      [
        { email, role: "owner", password_set_at: activatedAt },
        { email, role: "owner", password_set_at: activatedAt },
      ],
    ];
    const f = vi.fn();
    for (const rows of responses) f.mockResolvedValueOnce(reply(rows));
    vi.stubGlobal("fetch", f);
    for (const _ of responses) expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });

  it("keeps current active owners and reviewers permitted with server-verified identical roles", async () => {
    const f = vi.fn(async () =>
      reply([
        { email, role: "owner", password_set_at: activatedAt, ever_activated_at: activatedAt, must_rotate_password: false },
      ]),
    );
    vi.stubGlobal("fetch", f);
    expect(await affiliateAdminSessionAuthorized()).toBe(true);
    member.affiliateMemberSession.mockReturnValue({ email, role: "reviewer" });
    f.mockResolvedValueOnce(
      reply([
        { email, role: "reviewer", password_set_at: activatedAt, ever_activated_at: activatedAt, must_rotate_password: false },
      ]),
    );
    expect(await affiliateAdminSessionAuthorized()).toBe(true);
    const [url, options] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("email=eq.");
    expect(options.method).toBe("GET");
    expect(options.redirect).toBe("manual");
  });

  it("revokes a previously issued member cookie during required temporary password rotation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply([{
      email, role: "owner", password_set_at: activatedAt,
      ever_activated_at: activatedAt, must_rotate_password: true,
    }])));
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });

  it("refuses member sessions with a password stamp but no immutable activation history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply([
          {
            email,
            role: "owner",
            password_set_at: activatedAt,
            ever_activated_at: null,
          },
        ]),
      ),
    );
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });

  it("fails closed on unavailable database, network failure, redirect and invalid JSON", async () => {
    database.affiliateDatabaseConfig.mockReturnValueOnce(null);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(reply([], 302))
      .mockResolvedValueOnce(reply("invalid-json"));
    vi.stubGlobal("fetch", f);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });

  it("keeps valid password + TOTP legacy owner session independent of invited owner roster", async () => {
    expect(createAffiliateAdminSession()).toBe(true);
    cookieApi.getCookie.mockReturnValue(cookieApi.setCookie.mock.calls[0]![1]);
    member.affiliateMemberSession.mockReturnValue(null);
    database.affiliateDatabaseConfig.mockReturnValue(null);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await affiliateAdminSessionAuthorized()).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it("denies without any valid legacy or member session", async () => {
    member.affiliateMemberSession.mockReturnValue(null);
    expect(await affiliateAdminSessionAuthorized()).toBe(false);
  });
});

describe("Affiliate server handler revocation coverage", () => {
  it("rechecks the live roster before confidential reads and applicant mutations as well as session UI", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/affiliate-functions.ts"), "utf8");
    // 6 protected POST handlers plus GET session state. Owner erasure has a
    // separate stricter C22 authorization and onboarding is independently gated.
    expect(source.match(/await affiliateAdminSessionAuthorized\(\)/g)).toHaveLength(7);
    expect(source).not.toMatch(/affiliateAdminSessionValid\(/);
    expect(source).toContain("affiliateActivatedOwnerStillAuthorized()");
  });
});
