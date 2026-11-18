import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  ownerAuthorized: vi.fn(),
  consume: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/lib/affiliate-database.server", () => ({
  affiliateDatabaseConfig: deps.config,
}));
vi.mock("@/lib/affiliate-owner-activation.server", () => ({
  affiliateActivatedOwnerStillAuthorized: deps.ownerAuthorized,
}));
vi.mock("@/lib/affiliate-throttle.server", () => ({
  consumeAffiliateRateLimit: deps.consume,
}));

import { provisionOwnerTemporaryPassword } from "@/lib/affiliate-owner-provision.server";

const email = "isabela.cpcontato@gmail.com";
const userId = "20dadf62-afd1-4649-815e-444b2d097c4b";
const headers = { apikey: "not-a-real-key", "content-type": "application/json" };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  deps.ownerAuthorized.mockReset().mockResolvedValue(true);
  deps.consume.mockReset().mockResolvedValue(true);
  deps.config.mockReset().mockReturnValue({
    url: "https://synthetic-dedicated-db.supabase.co",
    headers,
  });
});

function successfulFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(Response.json(true))
    .mockResolvedValueOnce(
      Response.json({
        users: [
          { id: userId, email },
          { id: "20dadf62-afd1-4649-815e-444b2d097c4c", email: "other@example.test" },
        ],
      }),
    )
    .mockResolvedValueOnce(Response.json({ id: userId, email }))
    .mockResolvedValueOnce(Response.json(true));
}

describe("owner-only emergency temporary credential provisioning", () => {
  it("requires activated owner authorization and never calls Auth for denied users", async () => {
    deps.ownerAuthorized.mockResolvedValue(false);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword(email)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("refuses user-selected addresses outside the exact pre-invited roster", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword("unknown@example.com")).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("uses only Auth Admin UPDATE for the existing user, then records required rotation", async () => {
    const request = successfulFetch();
    vi.stubGlobal("fetch", request);
    const result = await provisionOwnerTemporaryPassword(email);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a provisional credential");
    expect(result.email).toBe(email);
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(32);
    expect(request).toHaveBeenCalledTimes(4);
    const [claimUrl] = request.mock.calls[0]!;
    expect(claimUrl).toContain("vonix_affiliate_claim_owner_temporary_provision");
    const [adminUrl, adminOptions] = request.mock.calls[2]!;
    expect(adminUrl).toBe(
      "https://synthetic-dedicated-db.supabase.co/auth/v1/admin/users/" + userId,
    );
    expect(adminOptions.method).toBe("PUT");
    expect(JSON.parse(adminOptions.body)).toEqual({
      password: result.temporaryPassword,
      email_confirm: true,
    });
    const [stageUrl, stageOptions] = request.mock.calls[3]!;
    expect(stageUrl).toContain("vonix_affiliate_complete_owner_temporary_provision");
    expect(JSON.parse(stageOptions.body)).toEqual({ p_email: email, p_user_id: userId });
  });

  it("does not issue a credential if a temporary provision is already in progress", async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword(email)).ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("refuses a duplicate Auth user for an invited email", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(
        Response.json({
          users: [
            { email, id: userId },
            { email, id: "20dadf62-afd1-4649-815e-444b2d097c4c" },
          ],
        }),
      );
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword(email)).ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not expose a password when Auth Admin declines the update", async () => {
    const request = successfulFetch();
    request
      .mockReset()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json({ users: [{ id: userId, email }] }))
      .mockResolvedValueOnce(new Response("blocked", { status: 403 }));
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword(email)).ok).toBe(false);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not claim successful activation when the privileged staging RPC fails", async () => {
    const request = successfulFetch();
    request.mockResolvedValueOnce(Response.json(false));
    // Preserve first three successful calls and replace the fourth only.
    request
      .mockReset()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json({ users: [{ id: userId, email }] }))
      .mockResolvedValueOnce(Response.json({ id: userId, email }))
      .mockResolvedValueOnce(Response.json(false));
    vi.stubGlobal("fetch", request);
    const result = await provisionOwnerTemporaryPassword(email);
    expect(result.ok).toBe(false);
    expect("temporaryPassword" in result).toBe(false);
  });

  it("rate-limits administrative provisioning attempts", async () => {
    deps.consume.mockResolvedValue(false);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect((await provisionOwnerTemporaryPassword(email)).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
