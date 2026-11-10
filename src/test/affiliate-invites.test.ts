import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ config: vi.fn() }));
vi.mock("@/lib/affiliate-database.server", () => ({
  affiliateDatabaseConfig: deps.config,
}));

import { invitePersistedAffiliateApplicant } from "@/lib/affiliate-invites.server";

describe("Vonix affiliate account invitation after durable registration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    deps.config.mockReset();
    deps.config.mockReturnValue({
      url: "https://synthetic-reference-123.supabase.co",
      headers: { apikey: "test-secret-never-real", authorization: "Bearer test-secret" },
    });
  });

  it("invites a valid applicant through server-only Auth Admin API", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", request);
    expect(await invitePersistedAffiliateApplicant("creator@example.invalid")).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toContain("/auth/v1/invite?redirect_to=");
    expect(decodeURIComponent(url)).toContain("https://vonixhair.com/acompanhar-inscricao");
    expect(options.method).toBe("POST");
    expect(options.headers.authorization).toBe("Bearer test-secret");
    expect(JSON.parse(options.body)).toEqual({ email: "creator@example.invalid" });
  });

  it("fails closed if Supabase private credentials are not configured", async () => {
    deps.config.mockReturnValue(null);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await invitePersistedAffiliateApplicant("creator@example.invalid")).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("never provisions a user for malformed email", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(await invitePersistedAffiliateApplicant("invalid-value")).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("never treats a rejected invitation as a delivered e-mail", async () => {
    const request = vi.fn().mockResolvedValue(new Response("blocked", { status: 422 }));
    vi.stubGlobal("fetch", request);
    expect(await invitePersistedAffiliateApplicant("creator@example.invalid")).toBe(false);
  });
});
