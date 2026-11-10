import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the real server-function handler without creating any HTTP server,
// external request, database write, or applicant record.
const gates = vi.hoisted(() => ({
  open: vi.fn(),
  sameOrigin: vi.fn(),
  quota: vi.fn(),
  create: vi.fn(),
  session: vi.fn(),
  allowed: vi.fn(),
  decide: vi.fn(),
  email: vi.fn(),
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
vi.mock("@/lib/affiliate-admin-auth.server", () => ({
  attemptAffiliateAdminLogin: vi.fn(),
}));
vi.mock("@/lib/affiliate-admin-session.server", () => ({
  affiliateAdminSameOrigin: gates.sameOrigin,
  affiliateMutationSameOrigin: gates.sameOrigin,
  affiliateAdminSessionValid: gates.session,
  destroyAffiliateAdminSession: vi.fn(),
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: gates.allowed,
  consumeAffiliateRateLimit: gates.quota,
}));
vi.mock("@/lib/affiliate-applications.server", () => ({
  affiliateRecruitmentOpen: gates.open,
  affiliateOperatorIntakeEnabled: gates.open,
  affiliateOperationalReadiness: vi.fn(),
  eraseAffiliateApplication: vi.fn(),
  previewAffiliateRetention: vi.fn(),
  createAffiliateApplication: gates.create,
  decideAffiliateApplication: gates.decide,
  listAffiliateApplications: vi.fn(),
  processAffiliateEmails: gates.email,
}));

import { reviewAffiliateApplication, submitAffiliateApplication } from "@/lib/affiliate-functions";

// Validation takes place in the framework before the handler. These synthetic
// values only exercise whether the side-effect is reached, never external I/O.
const submit = submitAffiliateApplication as unknown as (args: {
  data: { wizard?: Record<string, string> };
}) => Promise<{ ok: boolean; reason?: string }>;

beforeEach(() => {
  vi.resetAllMocks();
  gates.open.mockReturnValue(true);
  gates.sameOrigin.mockReturnValue(true);
  gates.quota.mockResolvedValue(true);
  gates.create.mockResolvedValue({ ok: true });
  gates.session.mockReturnValue(true);
  gates.allowed.mockResolvedValue(true);
  gates.decide.mockResolvedValue(true);
  gates.email.mockResolvedValue({ sent: 0, failed: 0, configured: false });
});

describe("Public affiliate submission origin policy", () => {
  it("refuses cross-site submissions before quota and database writes", async () => {
    gates.sameOrigin.mockReturnValue(false);
    const result = await submit({ data: { wizard: { firstName: "Example" } } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/formulário oficial/);
    expect(gates.quota).not.toHaveBeenCalled();
    expect(gates.create).not.toHaveBeenCalled();
  });

  it("preserves the closed-by-default launch gate", async () => {
    gates.open.mockReturnValue(false);
    const result = await submit({ data: { wizard: { firstName: "Example" } } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Inscrições ainda não disponíveis/);
    expect(gates.sameOrigin).not.toHaveBeenCalled();
    expect(gates.create).not.toHaveBeenCalled();
  });

  it("refuses legacy single-step payloads even with a trusted origin", async () => {
    const result = await submit({ data: {} });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cinco etapas/);
    expect(gates.quota).not.toHaveBeenCalled();
    expect(gates.create).not.toHaveBeenCalled();
  });

  it("checks rate limiting and forwards only trusted wizard submissions", async () => {
    const data = { wizard: { firstName: "Example" } };
    const result = await submit({ data });
    expect(result.ok).toBe(true);
    expect(gates.quota).toHaveBeenCalledWith("submit");
    expect(gates.create).toHaveBeenCalledWith(data);
    expect(gates.create).toHaveBeenCalledOnce();
  });

  it("fails closed when distributed quota rejects the request", async () => {
    gates.quota.mockResolvedValue(false);
    const result = await submit({ data: { wizard: { firstName: "Example" } } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Muitas tentativas/);
    expect(gates.create).not.toHaveBeenCalled();
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
