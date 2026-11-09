import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  sendPaidOrder: vi.fn(),
  blingEnabled: vi.fn(() => true),
  loadOrderSnapshot: vi.fn(),
}));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) =>
    key === "SUPABASE_URL" ? "https://test-database.example" : "service-role-test-only",
}));
vi.mock("@/lib/appmax.server", () => ({
  getOrder: mocks.getOrder,
  isReadyForFulfillment: (o: { data: { order: { status: string } } }) =>
    o.data.order.status === "integrado",
}));
vi.mock("@/lib/order-snapshot.server", () => ({ loadOrderSnapshot: mocks.loadOrderSnapshot }));
vi.mock("@/lib/bling.server", () => ({
  sendPaidOrder: mocks.sendPaidOrder,
  blingEnabled: mocks.blingEnabled,
}));
import { enqueueOrder, processOrderOutbox } from "@/lib/order-outbox.server";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (input: string, init: RequestInit) => {
    if (input.includes("rpc/vonix_claim_order_outbox"))
      return Response.json([{ order_id: 12, claim_token: "11111111-1111-4111-8111-111111111111" }]);
    if (input.includes("rpc/vonix_enqueue_order")) return new Response(null, { status: 204 });
    if (input.includes("order_id=eq.12")) return Response.json([{ order_id: 12 }]);
    throw new Error("unexpected mock URL " + input + " " + init.method);
  });
  mocks.getOrder.mockResolvedValue({ data: { order: { id: 12, status: "integrado" } } });
  mocks.loadOrderSnapshot.mockResolvedValue({ orderId: 12, customer: { name: "Teste" } });
  mocks.sendPaidOrder.mockResolvedValue("enviado");
});

describe("durable Appmax outbox", () => {
  it("enqueues by unique order_id without calling Appmax or Bling", async () => {
    await enqueueOrder(12);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("rpc/vonix_enqueue_order"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Prefer: "return=minimal" }),
      }),
    );
    expect(mocks.getOrder).not.toHaveBeenCalled();
    expect(mocks.sendPaidOrder).not.toHaveBeenCalled();
  });
  it("checks the authoritative order and dispatches once after integration", async () => {
    expect(await processOrderOutbox(1)).toEqual({
      claimed: 1,
      exported: 1,
      alreadyExported: 0,
      deferred: 0,
      failed: 0,
    });
    expect(mocks.getOrder).toHaveBeenCalledWith(12);
    expect(mocks.sendPaidOrder).toHaveBeenCalledTimes(1);
    expect(mocks.loadOrderSnapshot).toHaveBeenCalledWith(12);
    expect(mocks.sendPaidOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: 12 }));
  });
  it("never exports an order merely authorized for antifraud", async () => {
    mocks.getOrder.mockResolvedValue({ data: { order: { id: 12, status: "autorizado" } } });
    const result = await processOrderOutbox(1);
    expect(result.deferred).toBe(1);
    expect(mocks.sendPaidOrder).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("order_id=eq.12"),
      expect.objectContaining({ body: expect.stringContaining('"status":"pending"') }),
    );
  });
  it("keeps failed Bling operations retryable", async () => {
    mocks.sendPaidOrder.mockRejectedValue(new Error("ERP unavailable"));
    const result = await processOrderOutbox(1);
    expect(result.failed).toBe(1);
    expect(result.exported).toBe(0);
  });
  it("recognizes existing Bling orders without creating duplicates", async () => {
    mocks.sendPaidOrder.mockResolvedValue("ja enviado");
    const result = await processOrderOutbox(1);
    expect(result.alreadyExported).toBe(1);
  });
});
