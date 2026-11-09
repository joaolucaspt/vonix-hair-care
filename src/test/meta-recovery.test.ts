import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  token: "test-only-meta-token",
  candidates: vi.fn(),
  defer: vi.fn(),
  getOrder: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) => (name === "META_CAPI_TOKEN" ? mocks.token : ""),
}));
vi.mock("@/lib/meta-purchase-delivery.server", () => ({
  dueMetaRecoveryOrders: mocks.candidates,
  deferMetaRecovery: mocks.defer,
}));
vi.mock("@/lib/appmax.server", () => ({
  getOrder: mocks.getOrder,
  isPaid: (o: { data: { order: { status: string } } }) =>
    ["aprovado", "integrado", "pendente_integracao"].includes(o.data.order.status),
}));
vi.mock("@/lib/order-events", () => ({
  isTerminatedOrder: (s: string) => ["cancelado", "recusado_por_risco", "estornado"].includes(s),
}));
vi.mock("@/lib/meta-capi.server", () => ({ sendVerifiedPurchase: mocks.send }));
import { recoverMetaPurchases } from "@/lib/meta-purchase-recovery.server";

const testPaidAt = new Date().toISOString();
const order = (id: number, status: string) => ({
  data: { order: { id, status }, payment: { paid_at: testPaidAt } },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "test-only-meta-token";
  mocks.candidates.mockResolvedValue([12]);
  mocks.getOrder.mockResolvedValue(order(12, "aprovado"));
  mocks.send.mockResolvedValue("sent");
  mocks.defer.mockResolvedValue(undefined);
});

describe("Meta paid purchase reconciliation runs independently of ERP fulfillment", () => {
  it("sends only after checking the merchant status for a locally enrolled candidate", async () => {
    expect(await recoverMetaPurchases(2)).toEqual({
      checked: 1,
      sent: 1,
      skipped: 0,
      deferred: 0,
      failed: 0,
    });
    expect(mocks.candidates).toHaveBeenCalledWith(2);
    expect(mocks.getOrder).toHaveBeenCalledExactlyOnceWith(12);
    expect(mocks.send).toHaveBeenCalledWith(order(12, "aprovado"));
    expect(mocks.defer).not.toHaveBeenCalled();
  });
  it("does not contact Appmax or Supabase while Meta is unconfigured", async () => {
    mocks.token = "";
    await expect(recoverMetaPurchases()).rejects.toThrow("Meta CAPI não configurada");
    expect(mocks.candidates).not.toHaveBeenCalled();
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });
  it("never sends for antifraud authorization, and defers further queries", async () => {
    mocks.getOrder.mockResolvedValue(order(12, "autorizado"));
    expect(await recoverMetaPurchases()).toMatchObject({ deferred: 1, sent: 0 });
    expect(mocks.defer).toHaveBeenCalledWith(12, 60);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("never sends cancelled orders; waits a day before rechecking", async () => {
    mocks.getOrder.mockResolvedValue(order(12, "cancelado"));
    expect(await recoverMetaPurchases()).toMatchObject({ deferred: 1, sent: 0 });
    expect(mocks.defer).toHaveBeenCalledWith(12, 1440);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("fails closed when Appmax returns the wrong order ID", async () => {
    mocks.getOrder.mockResolvedValue(order(999, "aprovado"));
    expect(await recoverMetaPurchases()).toMatchObject({ failed: 1, sent: 0 });
    expect(mocks.defer).toHaveBeenCalledWith(12, 15);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not throw for one failed Meta event while other paid events can recover", async () => {
    mocks.candidates.mockResolvedValue([12, 13]);
    mocks.getOrder.mockImplementation(async (id: number) => order(id, "integrado"));
    mocks.send.mockResolvedValueOnce("failed").mockResolvedValueOnce("sent");
    expect(await recoverMetaPurchases(2)).toEqual({
      checked: 2,
      sent: 1,
      skipped: 0,
      deferred: 0,
      failed: 1,
    });
    expect(mocks.defer).toHaveBeenCalledExactlyOnceWith(12, 15);
  });
  it("does not send or claim Purchase with no Appmax payment timestamp; defers polling", async () => {
    mocks.getOrder.mockResolvedValue({ data: { order: { id: 12, status: "aprovado" } } });
    expect(await recoverMetaPurchases()).toMatchObject({ sent: 0, deferred: 1, failed: 0 });
    expect(mocks.defer).toHaveBeenCalledExactlyOnceWith(12, 60);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send or claim Purchase with an old/invalid timestamp", async () => {
    const old = new Date(Date.now() - 9 * 24 * 3600_000).toISOString();
    mocks.getOrder.mockResolvedValue({
      data: { order: { id: 12, status: "aprovado" }, payment: { paid_at: old } },
    });
    expect(await recoverMetaPurchases()).toMatchObject({ sent: 0, deferred: 1 });
    expect(mocks.defer).toHaveBeenCalledExactlyOnceWith(12, 1440);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not re-send events already delivered or leased to another worker", async () => {
    mocks.send.mockResolvedValue("skipped");
    expect(await recoverMetaPurchases()).toMatchObject({ sent: 0, skipped: 1 });
    expect(mocks.defer).not.toHaveBeenCalled();
  });
  it("does not expose gateway details on unexpected provider failures", async () => {
    mocks.getOrder.mockRejectedValue(new Error("sensitive provider error"));
    expect(await recoverMetaPurchases()).toMatchObject({ failed: 1 });
    expect(mocks.defer).toHaveBeenCalledWith(12, 15);
  });
});
