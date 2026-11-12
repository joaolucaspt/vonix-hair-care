import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const gates = vi.hoisted(() => ({
  origin: vi.fn(),
  member: vi.fn(),
  database: vi.fn(),
  rate: vi.fn(),
  fingerprint: vi.fn(),
  emailReady: vi.fn(),
  sendEmail: vi.fn(),
  managedEmail: vi.fn(),
  inspectDomain: vi.fn(),
}));

vi.mock("@/lib/affiliate-resend-domain.server", () => ({
  inspectAffiliateResendSenderDomain: gates.inspectDomain,
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
  affiliateCustomAuthEmailReady: gates.emailReady,
  sendAffiliateAuthEmailWithResend: gates.sendEmail,
  sendAffiliateManagedAuthOtp: gates.managedEmail,
}));

import {
  generatePendingAffiliateOwnerActivationLink,
  listPendingAffiliateOwnerActivations,
  sendPendingAffiliateOwnerActivationEmail,
  diagnoseAffiliateOwnerSender,
  affiliateActivatedOwnerStillAuthorized,
} from "@/lib/affiliate-owner-activation.server";

const root = "https://jewbzrbbvxyqmxqbrwrq.supabase.co";
const live = "https://vonixhair.com/acesso-equipe-afiliadas";
const email = "pending.owner@example.invalid";
const tokenHash = "a".repeat(64);
const privateShareLink = live + "#vonix_invite=" + tokenHash;
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
  gates.emailReady.mockReturnValue(true);
  gates.sendEmail.mockResolvedValue(true);
  gates.managedEmail.mockResolvedValue(true);
  gates.inspectDomain.mockResolvedValue({ status: "verified", domain: "vonixhair.com" });
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

  it("allows only an activated owner to request a branded email for a pending owner", async () => {
    const fetcher = mockFetch(Response.json(owner), Response.json(pending));
    expect(await sendPendingAffiliateOwnerActivationEmail(email)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(gates.sendEmail).toHaveBeenCalledExactlyOnceWith(email, "owner");
  });

  it("refuses email delivery to an uninvited recipient", async () => {
    const fetcher = mockFetch(Response.json(owner), Response.json(pending));
    expect((await sendPendingAffiliateOwnerActivationEmail("stranger@example.invalid")).ok).toBe(
      false,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(gates.sendEmail).not.toHaveBeenCalled();
  });

  it("does not send emails without a verified owner or an accessible protected roster", async () => {
    gates.member.mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());
    expect((await sendPendingAffiliateOwnerActivationEmail(email)).ok).toBe(false);
    expect(gates.sendEmail).not.toHaveBeenCalled();
    gates.member.mockReturnValue({ email: actor, role: "owner" });
    gates.emailReady.mockReturnValue(false);
    expect((await sendPendingAffiliateOwnerActivationEmail(email)).ok).toBe(false);
    // The active owner is revalidated from the protected roster even when
    // the branded provider is unavailable. A failed authorization still denies.
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it("surfaces provider rejection without pretending a message was delivered", async () => {
    gates.sendEmail.mockResolvedValue(false);
    mockFetch(Response.json(owner), Response.json(pending));
    const result = await sendPendingAffiliateOwnerActivationEmail(email);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("auth/v1/verify");
  });

  it("generates an Auth-only, single-use link after checking the recipient and durable quota", async () => {
    const fetcher = mockFetch(
      Response.json(owner),
      Response.json(pending),
      Response.json(true),
      Response.json({ properties: { action_link: tokenLink, hashed_token: tokenHash } }),
    );
    expect(await generatePendingAffiliateOwnerActivationLink(email)).toEqual({
      ok: true,
      link: privateShareLink,
      recipient: email,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(privateShareLink).not.toContain("synthetic-one-use-token");
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
        hashed_token: tokenHash,
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

it("distinguishes an unavailable roster query after verified owner authorization", async () => {
  const fetcher = mockFetch(Response.json(owner), new Response("", { status: 503 }));
  expect(await listPendingAffiliateOwnerActivations()).toEqual({
    ok: false,
    owners: [],
    reason: "temporarily-unavailable",
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    JSON.stringify(await Promise.resolve({ reason: "temporarily-unavailable" })),
  ).not.toContain(email);
});

it("falls back to the managed Supabase email only for an already-invited pending owner", async () => {
  gates.emailReady.mockReturnValue(false);
  const fetcher = mockFetch(Response.json(owner), Response.json(pending));
  expect(await sendPendingAffiliateOwnerActivationEmail(email)).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(gates.managedEmail).toHaveBeenCalledExactlyOnceWith(email, "owner");
  expect(gates.sendEmail).not.toHaveBeenCalled();
});

it("never attempts managed fallback for nonowners or uninvited addresses", async () => {
  gates.emailReady.mockReturnValue(false);
  gates.member.mockReturnValue(null);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await sendPendingAffiliateOwnerActivationEmail(email)).ok).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  gates.member.mockReturnValue({ email: actor, role: "owner" });
  const eligible = mockFetch(Response.json(owner), Response.json(pending));
  expect((await sendPendingAffiliateOwnerActivationEmail("stranger@example.invalid")).ok).toBe(
    false,
  );
  expect(eligible).toHaveBeenCalledTimes(2);
  expect(gates.managedEmail).not.toHaveBeenCalled();
});

it("does not claim accepted email when the managed provider rejects it", async () => {
  gates.emailReady.mockReturnValue(false);
  gates.managedEmail.mockResolvedValue(false);
  mockFetch(Response.json(owner), Response.json(pending));
  expect((await sendPendingAffiliateOwnerActivationEmail(email)).ok).toBe(false);
  expect(gates.managedEmail).toHaveBeenCalledOnce();
});

it("rejects read-only sender diagnosis for nonowners without reaching Resend", async () => {
  gates.member.mockReturnValue(null);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(await diagnoseAffiliateOwnerSender()).toEqual({ ok: false });
  expect(gates.inspectDomain).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it("revalidates owner activation before reading provider status without emailing anyone", async () => {
  const fetcher = mockFetch(Response.json(owner));
  expect(await diagnoseAffiliateOwnerSender()).toEqual({
    ok: true,
    diagnosis: { status: "verified", domain: "vonixhair.com" },
  });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0]![0]).toContain("/rest/v1/vonix_affiliate_admin_invites");
  expect(gates.inspectDomain).toHaveBeenCalledOnce();
  expect(gates.sendEmail).not.toHaveBeenCalled();
  expect(gates.managedEmail).not.toHaveBeenCalled();
});

it("never diagnoses a deactivated owner even if an old signed cookie exists", async () => {
  const fetcher = mockFetch(
    Response.json([{ email: actor, role: "owner", password_set_at: null }]),
  );
  expect(await diagnoseAffiliateOwnerSender()).toEqual({ ok: false });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(gates.inspectDomain).not.toHaveBeenCalled();
});

describe("current-owner authorization for irreversible applicant erasure", () => {
  it("allows an activated member owner only after a fresh allowlist query", async () => {
    const fetcher = mockFetch(Response.json(owner));
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]![0])).toContain("email=eq.");
  });

  it("denies signed owner cookies after the owner password activation is revoked", async () => {
    const fetcher = mockFetch(
      Response.json([{ email: actor, role: "owner", password_set_at: null }]),
    );
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refuses a downgraded team role or failed protected roster query", async () => {
    const fetcher = mockFetch(
      Response.json([
        { email: actor, role: "reviewer", password_set_at: "2026-11-10T19:00:00+00:00" },
      ]),
    );
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
    const failed = mockFetch(new Response(null, { status: 503 }));
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(false);
    expect(failed).toHaveBeenCalledOnce();
  });

  it("denies missing owner cookie and inaccessible per-IP quota before any roster request", async () => {
    gates.member.mockReturnValue(null);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(false);
    gates.member.mockReturnValue({ email: actor, role: "owner" });
    gates.rate.mockResolvedValue(false);
    expect(await affiliateActivatedOwnerStillAuthorized()).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
