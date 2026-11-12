import { beforeEach, describe, expect, it, vi } from "vitest";
import { setResponseHeader } from "@tanstack/react-start/server";

// Exercise the real server-function handler without creating any HTTP server,
// external request, database write, or applicant record.
const gates = vi.hoisted(() => ({
  open: vi.fn(),
  sameOrigin: vi.fn(),
  quota: vi.fn(),
  create: vi.fn(),
  createSimple: vi.fn(),
  list: vi.fn(),
  readiness: vi.fn(),
  retention: vi.fn(),
  session: vi.fn(),
  allowed: vi.fn(),
  decide: vi.fn(),
  email: vi.fn(),
  authorized: vi.fn(),
  sendAuth: vi.fn(),
  sendManaged: vi.fn(),
  emailReady: vi.fn(),
  mayErase: vi.fn(),
  legacyOwner: vi.fn(),
  activeOwner: vi.fn(),
  erase: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator(_schema: unknown) {
      return this;
    },
    handler(fn: (...args: unknown[]) => unknown) {
      return fn;
    },
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/lib/affiliate-auth-delivery.server", () => ({
  affiliateCustomAuthEmailReady: gates.emailReady,
  affiliateEmailAuthorizedForPortal: gates.authorized,
  sendAffiliateAuthEmailWithResend: gates.sendAuth,
  sendAffiliateManagedAuthOtp: gates.sendManaged,
}));
vi.mock("@/lib/affiliate-admin-auth.server", () => ({
  attemptAffiliateAdminLogin: vi.fn(),
}));
vi.mock("@/lib/affiliate-admin-session.server", () => ({
  affiliateAdminSameOrigin: gates.sameOrigin,
  affiliateMutationSameOrigin: gates.sameOrigin,
  affiliateAdminSessionValid: gates.session,
  destroyAffiliateAdminSession: vi.fn(),
  affiliateAdminMayErase: gates.mayErase,
  affiliateLegacyAdminSessionValid: gates.legacyOwner,
}));
vi.mock("@/lib/affiliate-owner-activation.server", () => ({
  affiliateActivatedOwnerStillAuthorized: gates.activeOwner,
  generatePendingAffiliateOwnerActivationLink: vi.fn(),
  diagnoseAffiliateOwnerSender: vi.fn(),
  listPendingAffiliateOwnerActivations: vi.fn(),
  sendPendingAffiliateOwnerActivationEmail: vi.fn(),
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: gates.allowed,
  consumeAffiliateRateLimit: gates.quota,
}));
vi.mock("@/lib/affiliate-applications.server", () => ({
  affiliateRecruitmentOpen: gates.open,
  affiliateOperatorIntakeEnabled: gates.open,
  affiliateOperationalReadiness: gates.readiness,
  eraseAffiliateApplication: gates.erase,
  // retention mock is provided below via gates.retention
  createAffiliateApplication: gates.create,
  createSimpleAffiliateApplication: gates.createSimple,
  decideAffiliateApplication: gates.decide,
  listAffiliateApplications: gates.list,
  previewAffiliateRetention: gates.retention,
  processAffiliateEmails: gates.email,
}));

import {
  requestAffiliateAccessEmail,
  reviewAffiliateApplication,
  getAffiliateApplications,
  getAffiliateOperationalReadiness,
  getAffiliateRetentionPreview,
  eraseAffiliateApplicationAdmin,
  submitAffiliateApplication,
  submitSimpleAffiliateApplication,
} from "@/lib/affiliate-functions";

// Validation takes place in the framework before the handler. These synthetic
// values only exercise whether the side-effect is reached, never external I/O.
const submit = submitSimpleAffiliateApplication as unknown as (args: {
  data: Record<string, unknown>;
}) => Promise<{ ok: boolean; reason?: string }>;

const legacySubmit = submitAffiliateApplication as unknown as (args: {
  data: Record<string, unknown>;
}) => Promise<{ ok: boolean; reason?: string }>;

beforeEach(() => {
  vi.resetAllMocks();
  gates.open.mockReturnValue(true);
  gates.sameOrigin.mockReturnValue(true);
  gates.quota.mockResolvedValue(true);
  gates.create.mockResolvedValue({ ok: true });
  gates.createSimple.mockResolvedValue({ ok: true });
  gates.list.mockResolvedValue({ rows: [{ full_name: "Pessoa Exemplo" }], total: 1 });
  gates.readiness.mockResolvedValue({ checks: [] });
  gates.retention.mockResolvedValue({ pending_eligible: 0, rejected_eligible: 0 });
  gates.session.mockReturnValue(true);
  gates.allowed.mockResolvedValue(true);
  gates.decide.mockResolvedValue(true);
  gates.email.mockResolvedValue({ sent: 0, failed: 0, configured: false });
  gates.authorized.mockResolvedValue(true);
  gates.sendAuth.mockResolvedValue(true);
  gates.sendManaged.mockResolvedValue(true);
  gates.emailReady.mockReturnValue(true);
  gates.mayErase.mockReturnValue(true);
  gates.legacyOwner.mockReturnValue(false);
  gates.activeOwner.mockResolvedValue(true);
  gates.erase.mockResolvedValue(true);
});

describe("Public simplified affiliate submission origin policy", () => {
  it("refuses cross-site submissions before quota and database writes", async () => {
    gates.sameOrigin.mockReturnValue(false);
    const result = await submit({ data: { fullName: "Exemplo" } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/formulário oficial/);
    expect(gates.quota).not.toHaveBeenCalled();
    expect(gates.createSimple).not.toHaveBeenCalled();
  });

  it("preserves the closed-by-default launch gate", async () => {
    gates.open.mockReturnValue(false);
    const result = await submit({ data: { fullName: "Exemplo" } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/inscrições ainda não estão disponíveis/i);
    expect(gates.sameOrigin).not.toHaveBeenCalled();
    expect(gates.createSimple).not.toHaveBeenCalled();
  });

  it("checks rate limiting and forwards only the simplified submission", async () => {
    const data = { fullName: "Pessoa Exemplo", instagramFollowers: 100 };
    const result = await submit({ data });
    expect(result.ok).toBe(true);
    expect(gates.quota).toHaveBeenCalledWith("submit");
    expect(gates.createSimple).toHaveBeenCalledWith(data);
    expect(gates.create).not.toHaveBeenCalled();
  });

  it("fails closed when distributed quota rejects the request", async () => {
    gates.quota.mockResolvedValue(false);
    const result = await submit({ data: { fullName: "Exemplo" } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Muitas tentativas/);
    expect(gates.createSimple).not.toHaveBeenCalled();
  });

  it("retires the old five-stage endpoint without contacting storage", async () => {
    const result = await legacySubmit({ data: { wizard: { firstName: "Exemplo" } } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cadastro antigo foi encerrado/);
    expect(gates.quota).not.toHaveBeenCalled();
    expect(gates.create).not.toHaveBeenCalled();
    expect(gates.createSimple).not.toHaveBeenCalled();
    expect(gates.sendAuth).not.toHaveBeenCalled();
  });
});

describe("Private Auth delivery recovery", () => {
  const requestAccess = requestAffiliateAccessEmail as unknown as (args: {
    data: { email: string; purpose: "applicant" | "owner" };
  }) => Promise<{ status: string }>;

  it("rejects cross-origin access requests before contacting the email provider", async () => {
    gates.sameOrigin.mockReturnValue(false);
    expect(
      await requestAccess({
        data: { email: "candidate@example.invalid", purpose: "applicant" },
      }),
    ).toMatchObject({ status: "denied" });
    expect(gates.quota).not.toHaveBeenCalled();
    expect(gates.sendAuth).not.toHaveBeenCalled();
  });

  it("sends an Auth code only after verifying the recipient belongs to the portal", async () => {
    expect(
      await requestAccess({
        data: { email: "owner@example.invalid", purpose: "owner" },
      }),
    ).toMatchObject({ status: "requested" });
    expect(gates.authorized).toHaveBeenCalledWith("owner@example.invalid", "owner");
    expect(gates.sendAuth).toHaveBeenCalledWith("owner@example.invalid", "owner");
  });

  it("routes a missing corporate provider through the server-only, roster-verified Supabase fallback", async () => {
    gates.emailReady.mockReturnValue(false);
    expect(
      await requestAccess({ data: { email: "owner@example.invalid", purpose: "owner" } }),
    ).toMatchObject({ status: "requested" });
    expect(gates.authorized).toHaveBeenCalledWith("owner@example.invalid", "owner");
    expect(gates.sendManaged).toHaveBeenCalledExactlyOnceWith("owner@example.invalid", "owner");
    expect(gates.sendAuth).not.toHaveBeenCalled();
    expect(gates.quota).toHaveBeenCalledWith("admin");
  });

  it("does not send Supabase fallback mail to non-invited addresses, with indistinguishable response", async () => {
    gates.emailReady.mockReturnValue(false);
    gates.authorized.mockResolvedValueOnce(false);
    expect(
      await requestAccess({ data: { email: "stranger@example.invalid", purpose: "owner" } }),
    ).toMatchObject({ status: "requested" });
    expect(gates.sendManaged).not.toHaveBeenCalled();
    expect(gates.sendAuth).not.toHaveBeenCalled();
  });

  it("fails closed before managed fallback when same-origin or quota denies access", async () => {
    gates.emailReady.mockReturnValue(false);
    gates.sameOrigin.mockReturnValue(false);
    expect(
      await requestAccess({ data: { email: "owner@example.invalid", purpose: "owner" } }),
    ).toMatchObject({ status: "denied" });
    gates.sameOrigin.mockReturnValue(true);
    gates.quota.mockResolvedValue(false);
    expect(
      await requestAccess({ data: { email: "owner@example.invalid", purpose: "owner" } }),
    ).toMatchObject({ status: "rate-limited" });
    expect(gates.authorized).not.toHaveBeenCalled();
    expect(gates.sendManaged).not.toHaveBeenCalled();
  });

  it("never contacts the provider for an unknown email", async () => {
    gates.authorized.mockResolvedValueOnce(false);
    expect(
      await requestAccess({
        data: { email: "random@example.invalid", purpose: "applicant" },
      }),
    ).toMatchObject({ status: "requested" });
    expect(gates.sendAuth).not.toHaveBeenCalled();
  });

  it("blocks repeated requests when the shared IP throttle is exhausted", async () => {
    gates.quota.mockResolvedValueOnce(false);
    expect(
      await requestAccess({
        data: { email: "candidate@example.invalid", purpose: "applicant" },
      }),
    ).toMatchObject({ status: "rate-limited" });
    expect(gates.sendAuth).not.toHaveBeenCalled();
  });
});

describe("Admin decision notification semantics", () => {
  const review = reviewAffiliateApplication as unknown as (args: {
    data: { id: string; decision: "aprovada" | "recusada" };
  }) => Promise<{
    ok: boolean;
    emailSent?: boolean;
    notification?: string;
  }>;

  const data = { id: "00000000-0000-4000-8000-000000000999", decision: "aprovada" as const };

  it("does not tell the operator an unconfigured email sender delivered a decision", async () => {
    gates.email.mockResolvedValueOnce({ sent: 0, failed: 0, configured: false });
    expect(await review({ data })).toMatchObject({
      ok: true,
      emailSent: false,
      notification: "unconfigured",
    });
    expect(gates.decide).toHaveBeenCalledOnce();
    expect(gates.email).toHaveBeenCalledWith(1, data.id);
  });

  it("distinguishes acceptance, queued and uncertain notification outcomes", async () => {
    for (const [mail, outcome] of [
      [{ sent: 1, failed: 0, configured: true }, "accepted"],
      [{ sent: 0, failed: 0, configured: true }, "queued"],
      [{ sent: 0, failed: 1, configured: true }, "review"],
    ] as const) {
      gates.email.mockResolvedValueOnce(mail);
      expect((await review({ data })).notification).toBe(outcome);
    }
    gates.email.mockRejectedValueOnce(new Error("synthetic provider outage"));
    expect(await review({ data })).toMatchObject({
      ok: true,
      notification: "review",
      emailSent: false,
    });
    expect(gates.decide).toHaveBeenCalledTimes(4);
  });

  it("requires same origin and signed admin session before recording decisions", async () => {
    gates.session.mockReturnValue(false);
    expect(await review({ data })).toMatchObject({ ok: false });
    expect(gates.decide).not.toHaveBeenCalled();
    gates.session.mockReturnValue(true);
    gates.sameOrigin.mockReturnValue(false);
    expect(await review({ data })).toMatchObject({ ok: false });
    expect(gates.decide).not.toHaveBeenCalled();
  });
});

describe("Privacy headers for the private submission receipt", () => {
  it("blocks browser and intermediary caching before returning a valid private tracking code", async () => {
    const receipt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    gates.createSimple.mockResolvedValueOnce({ ok: true, trackingCode: receipt });
    const result = (await submit({ data: { fullName: "Candidata Exemplo" } })) as {
      ok: boolean;
      trackingCode?: string;
    };
    expect(result).toEqual({ ok: true, trackingCode: receipt });
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(setResponseHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("also sends privacy headers if a cross-origin submit is rejected", async () => {
    gates.sameOrigin.mockReturnValue(false);
    expect((await submit({ data: { fullName: "Exemplo" } })).ok).toBe(false);
    expect(gates.createSimple).not.toHaveBeenCalled();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(setResponseHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("keeps the same no-store policy for quota failures without issuing a receipt", async () => {
    gates.quota.mockResolvedValue(false);
    expect((await submit({ data: { fullName: "Exemplo" } })).ok).toBe(false);
    expect(gates.createSimple).not.toHaveBeenCalled();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
  });
});

describe("Protected admin read responses never use public or browser caching", () => {
  const list = getAffiliateApplications as unknown as (args: {
    data: { status: "pendente" | "todas"; page: number };
  }) => Promise<{ ok: boolean; rows?: Array<{ full_name: string }> }>;

  const readiness = getAffiliateOperationalReadiness as unknown as () => Promise<{ ok: boolean }>;
  const retention = getAffiliateRetentionPreview as unknown as (args: {
    data: { pendingDays: number; rejectedDays: number };
  }) => Promise<{ ok: boolean }>;

  it("prevents caching and referer propagation of the protected applicant roster", async () => {
    const result = await list({ data: { status: "pendente", page: 0 } });
    expect(result).toMatchObject({ ok: true, rows: [{ full_name: "Pessoa Exemplo" }] });
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(setResponseHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("does not cache authorization failures or expose any list data", async () => {
    gates.session.mockReturnValue(false);
    expect(await list({ data: { status: "todas", page: 0 } })).toMatchObject({ ok: false });
    expect(gates.list).not.toHaveBeenCalled();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
  });

  it("does not cache privileged operational configuration", async () => {
    expect(await readiness()).toMatchObject({ ok: true });
    expect(gates.readiness).toHaveBeenCalledOnce();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
    expect(setResponseHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("does not cache privileged data-retention estimates", async () => {
    expect(await retention({ data: { pendingDays: 90, rejectedDays: 180 } })).toMatchObject({
      ok: true,
    });
    expect(gates.retention).toHaveBeenCalledOnce();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
  });
});

describe("LGPD erasure revocation gate", () => {
  const erase = eraseAffiliateApplicationAdmin as unknown as (args: {
    data: { id: string; emailConfirmation: string; reason: "solicitacao_titular" };
  }) => Promise<{ ok: boolean }>;
  const data = {
    id: "00000000-0000-4000-8000-000000000999",
    emailConfirmation: "example.invalid",
    reason: "solicitacao_titular" as const,
  };

  it("refuses irreversible deletion when a member owner's signed cookie survives roster revocation", async () => {
    gates.activeOwner.mockResolvedValue(false);
    expect((await erase({ data })).ok).toBe(false);
    expect(gates.erase).not.toHaveBeenCalled();
    expect(gates.activeOwner).toHaveBeenCalledOnce();
  });

  it("allows an activated owner after a fresh live allowlist check", async () => {
    expect(await erase({ data })).toEqual({ ok: true });
    expect(gates.activeOwner).toHaveBeenCalledOnce();
    expect(gates.erase).toHaveBeenCalledOnce();
  });

  it("keeps legacy TOTP owner support independent of an unrelated member cookie", async () => {
    gates.legacyOwner.mockReturnValue(true);
    gates.activeOwner.mockResolvedValue(false);
    expect(await erase({ data })).toEqual({ ok: true });
    expect(gates.activeOwner).not.toHaveBeenCalled();
    expect(gates.erase).toHaveBeenCalledOnce();
  });

  it("fails closed on a live roster outage instead of erasing data", async () => {
    gates.activeOwner.mockRejectedValue(new TypeError("upstream unavailable"));
    expect((await erase({ data })).ok).toBe(false);
    expect(gates.erase).not.toHaveBeenCalled();
  });

  it("never consults owner roster or erases on cross-origin and invalid sessions", async () => {
    gates.sameOrigin.mockReturnValue(false);
    expect((await erase({ data })).ok).toBe(false);
    gates.sameOrigin.mockReturnValue(true);
    gates.mayErase.mockReturnValue(false);
    expect((await erase({ data })).ok).toBe(false);
    expect(gates.activeOwner).not.toHaveBeenCalled();
    expect(gates.erase).not.toHaveBeenCalled();
  });
});
