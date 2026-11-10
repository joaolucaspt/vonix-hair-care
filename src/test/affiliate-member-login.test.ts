import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  sameOrigin: vi.fn(),
  allowed: vi.fn(),
  consume: vi.fn(),
  createSession: vi.fn(),
}));
vi.mock("@/lib/affiliate-admin-session.server", () => ({
  affiliateAdminSameOrigin: deps.sameOrigin,
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: deps.allowed,
  consumeAffiliateRateLimit: deps.consume,
}));
vi.mock("@/lib/affiliate-member-session.server", () => ({
  createAffiliateMemberSession: deps.createSession,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  VONIX_AFFILIATE_AUTH_URL: "https://synthetic-project.supabase.co",
  VONIX_AFFILIATE_PUBLIC_KEY: "sb_publishable_synthetic_not_a_secret",
}));

import { loginAffiliateTeamWithPassword } from "@/lib/affiliate-member-auth.server";

const email = "reviewer@example.invalid";
const password = "LongPersonalPassword!2026";

beforeEach(() => {
  vi.restoreAllMocks();
  deps.sameOrigin.mockReset().mockReturnValue(true);
  deps.allowed.mockReset().mockResolvedValue(true);
  deps.consume.mockReset().mockResolvedValue(true);
  deps.createSession.mockReset().mockReturnValue(true);
});

describe("Vonix private admin role login", () => {
  it("requires a real Supabase password grant, confirmed e-mail and active invite", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "a".repeat(150),
            user: { email, email_confirmed_at: "2026-11-10T03:00:00Z" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              email,
              role: "reviewer",
              password_set_at: "2026-11-10T03:10:00Z",
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", request);
    expect(await loginAffiliateTeamWithPassword(email, password)).toEqual({ ok: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]![0]).toContain("grant_type=password");
    expect(JSON.parse(request.mock.calls[0]![1].body)).toEqual({ email, password });
    expect(deps.createSession).toHaveBeenCalledWith({ email, role: "reviewer" });
  });

  it("never accepts an OTP access token in place of a personal password", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect((await loginAffiliateTeamWithPassword(email, "eyJ." + "a".repeat(150))).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("rejects valid Supabase logins without activated Vonix admin membership", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "a".repeat(150),
            user: { email, email_confirmed_at: "2026-11-10T03:00:00Z" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", request);
    expect((await loginAffiliateTeamWithPassword(email, password)).ok).toBe(false);
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  it("enforces same origin before ever requesting Supabase credentials", async () => {
    deps.sameOrigin.mockReturnValue(false);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect((await loginAffiliateTeamWithPassword(email, password)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
