import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the real server-function handler without creating any HTTP server,
// external request, database write, or applicant record.
const gates = vi.hoisted(() => ({
  open: vi.fn(),
  sameOrigin: vi.fn(),
  quota: vi.fn(),
  create: vi.fn(),
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
  affiliateAdminSameOrigin: vi.fn(),
  affiliateMutationSameOrigin: gates.sameOrigin,
  affiliateAdminSessionValid: vi.fn(),
  destroyAffiliateAdminSession: vi.fn(),
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  affiliateRateLimitAllowed: vi.fn(),
  consumeAffiliateRateLimit: gates.quota,
}));
vi.mock("@/lib/affiliate-applications.server", () => ({
  affiliateRecruitmentOpen: gates.open,
  affiliateOperationalReadiness: vi.fn(),
  eraseAffiliateApplication: vi.fn(),
  previewAffiliateRetention: vi.fn(),
  createAffiliateApplication: gates.create,
  decideAffiliateApplication: vi.fn(),
  listAffiliateApplications: vi.fn(),
  processAffiliateEmails: vi.fn(),
}));

import { submitAffiliateApplication } from "@/lib/affiliate-functions";

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
