import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  secret: "test-only-meta-recovery-secret-at-least-32-characters",
  recover: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (cfg: unknown) => cfg }));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) => (name === "META_RECOVERY_SECRET" ? mocks.secret : ""),
}));
vi.mock("@/lib/meta-purchase-recovery.server", () => ({ recoverMetaPurchases: mocks.recover }));
import { receiveMetaRecovery } from "@/routes/api.internal.meta-recovery";

const request = (token?: string) =>
  new Request("https://vonixhair.com/api/internal/meta-recovery", {
    method: "POST",
    ...(token ? { headers: { authorization: "Bearer " + token } } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.secret = "test-only-meta-recovery-secret-at-least-32-characters";
  mocks.recover.mockResolvedValue({ checked: 2, sent: 1, skipped: 0, deferred: 1, failed: 0 });
});
describe("private Meta recovery worker endpoint", () => {
  it("rejects anonymous and wrong credentials without accessing providers", async () => {
    expect((await receiveMetaRecovery(request())).status).toBe(401);
    expect((await receiveMetaRecovery(request("wrong"))).status).toBe(401);
    expect(mocks.recover).not.toHaveBeenCalled();
  });
  it("rejects missing or weak secrets fail closed", async () => {
    mocks.secret = "";
    expect((await receiveMetaRecovery(request())).status).toBe(401);
    mocks.secret = "short";
    expect((await receiveMetaRecovery(request("short"))).status).toBe(401);
    expect(mocks.recover).not.toHaveBeenCalled();
  });
  it("returns only counts with no-cache headers after valid authentication", async () => {
    const res = await receiveMetaRecovery(request(mocks.secret));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ checked: 2, sent: 1, skipped: 0, deferred: 1, failed: 0 });
    expect(mocks.recover).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("does not reveal database/provider errors", async () => {
    mocks.recover.mockRejectedValueOnce(new Error("secret provider value"));
    const res = await receiveMetaRecovery(request(mocks.secret));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("secret provider value");
  });
});
