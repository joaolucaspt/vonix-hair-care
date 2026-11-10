import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const gates = vi.hoisted(() => ({
  origin: vi.fn(),
  member: vi.fn(),
  database: vi.fn(),
  rate: vi.fn(),
  fingerprint: vi.fn(),
}));

vi.mock("@/lib/affiliate-admin-session.server", () => ({
  affiliateAdminSameOrigin: gates.origin,
}));
vi.mock("@/lib/affiliate-member-session.server", () => ({
  affiliateMemberSession: gates.member,
}));
vi.mock("@/lib/affiliate-database.server", () => ({
  affiliateDatabaseConfig: gates.database,
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: gates.rate,
}));
vi.mock("@/lib/affiliate-auth-delivery.server", () => ({
  affiliateAccessEmailFingerprint: gates.fingerprint,
}));

import {
  generatePendingAffiliateOwnerActivationLink,
  listPendingAffiliateOwnerActivations,
} from "@/lib/affiliate-owner-activation.server";

const root = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
const live = "https://vonixhair.com/acesso-equipe-afiliadas";
const email = "pending.owner@example.invalid";
const actor = "activated.owner@example.invalid";
const owner = [{ email: actor, role: "owner", password_set_at: "2026-11-10T19:00:00+00:00" }];
const pending = [{ email, role: "owner", password_set_at: null }];
const tokenLink =
  root +
  "/auth/v1/verify?token=" +
  "synthetic-one-use-token-1234567890" +
  "&type=magiclink&redirect_to=" +
  encodeURIComponent(live);

const mockFetch = (...values: Response[]) => {
  const fetcher = vi.fn();
  values.forEach((value) => fetcher.mockResolvedValueOnce(value));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

beforeEach(() => {
  vi.resetAllMocks();
  gates.origin.mockReturnValue(true);
  gates.member.mockReturnValue({ email: actor, role: "owner" });
  gates.database.mockReturnValue({ url: root, headers: { apikey: "synthetic-privileged-key" } });
  gates.rate.mockResolvedValue(true);
  gates.fingerprint.mockReturnValue("f".repeat(64));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("owner-mediated one-time activation without transactional email", () => {
  it("does not enumerate invitees for anonymous callers", async () => {
    gates.member.mockReturnValue(null);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await listPendingAffiliateOwnerActivations()).toEqual({ ok: false, owners: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("denies reviewers and cross-origin callers", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    gates.member.mockReturnValue({ email: "reviewer@example.invalid", role: "reviewer" });
    expect((await generatePendingAffiliateOwnerActivationLink(email)).ok).toBe(false);
    gates.member.mockReturnValue({ email: actor, role: "owner" });
    gates.origin.mockReturnValue(false);
    expect((await generatePendingAffiliateOwnerActivationLink(email)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires an activated owner currently present in the dedicated database", async () => {
    const fetcher = mockFetch(
      Response.json([{ email: actor, role: "owner", password_set_at: null }]),
    );
    expect((await listPendingAffiliateOwnerActivations()).ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns only pending already-invited owners to a verified activated owner", async () => {
    const fetcher = mockFetch(Response.json(owner), Response.json(pending));
    expect(await listPendingAffiliateOwnerActivations()).toEqual({
      ok: true,
      owners: [{ email }],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![0]).toContain("password_set_at=is.null");
    expect(fetcher.mock.calls[1]![0]).toContain("role=eq.owner");
  });

  it("generates an Auth-only, single-use link after checking the recipient and durable quota", async () => {
    const fetcher = mockFetch(
      Response.json(owner),
      Response.json(pending),
      Response.json(true),
      Response.json({ properties: { action_link: tokenLink } }),
    );
    expect(await generatePendingAffiliateOwnerActivationLink(email)).toEqual({
      ok: true,
      link: tokenLink,
      recipient: email,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[2]![0]).toContain("consume_auth_mail_cooldown");
    const options = fetcher.mock.calls[3]![1] as RequestInit;
    expect(JSON.parse(options.body as string)).toEqual({
      type: "magiclink",
      email,
      redirect_to: live,
    });
    expect(fetcher.mock.calls[3]![0]).toBe(root + "/auth/v1/admin/generate_link");
    expect(gates.fingerprint).toHaveBeenCalledWith(email);
  });

  it("never generates a link for a non-invited address, even if requested by an owner", async () => {
    const fetcher = mockFetch(Response.json(owner), Response.json(pending));
    expect((await generatePendingAffiliateOwnerActivationLink("stranger@example.invalid")).ok).toBe(
      false,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not generate again while the recipient security cooldown is active", async () => {
    const fetcher = mockFetch(Response.json(owner), Response.json(pending), Response.json(false));
    const result = await generatePendingAffiliateOwnerActivationLink(email);
    expect(result.ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects upstream links that redirect outside the designated portal", async () => {
    const fetcher = mockFetch(
      Response.json(owner),
      Response.json(pending),
      Response.json(true),
      Response.json({
        action_link: tokenLink.replace(
          encodeURIComponent(live),
          encodeURIComponent("https://attacker.invalid"),
        ),
      }),
    );
    const result = await generatePendingAffiliateOwnerActivationLink(email);
    expect(result.ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result)).not.toContain("synthetic-one-use-token");
  });

  it("does not return an Auth link when the database configuration or rate limit is missing", async () => {
    gates.database.mockReturnValue(null);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await generatePendingAffiliateOwnerActivationLink(email)).ok).toBe(false);
    gates.database.mockReturnValue({ url: root, headers: { apikey: "synthetic-key" } });
    gates.rate.mockResolvedValue(false);
    expect((await generatePendingAffiliateOwnerActivationLink(email)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
