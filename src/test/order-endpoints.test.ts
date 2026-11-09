import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  enqueueOrder: vi.fn(),
  processOrderOutbox: vi.fn(),
  reconcileOrderOutbox: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ config }),
}));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    (
      ({
        ORDER_WORKER_SECRET: "test-only-worker-secret",
        APPMAX_WEBHOOK_SITE_ID: "site-test",
        APPMAX_WEBHOOK_APP_ID: "app-test",
      }) as Record<string, string>
    )[name] ?? "",
}));
vi.mock("@/lib/order-outbox.server", () => ({
  enqueueOrder: mocks.enqueueOrder,
  processOrderOutbox: mocks.processOrderOutbox,
  reconcileOrderOutbox: mocks.reconcileOrderOutbox,
}));
import { receiveAppmaxWebhook } from "@/routes/api.public.appmax-webhook";
import { receiveOrderWorker } from "@/routes/api.internal.order-worker";

const request = (data: unknown, headers: Record<string, string> = {}) =>
  new Request("https://test.example/api/public/appmax-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      event_type: "order",
      site_id: "site-test",
      app_id: "app-test",
      ...(data as Record<string, unknown>),
    }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reconcileOrderOutbox.mockResolvedValue(2);
});

describe("Appmax webhook is durable and does no synchronous ERP work", () => {
  it("accepts official nested order.id only after durable enqueue", async () => {
    const response = await receiveAppmaxWebhook(
      request({ event: "order_integrated", data: { order: { id: 10 } } }),
    );
    expect(response.status).toBe(202);
    expect(mocks.enqueueOrder).toHaveBeenCalledExactlyOnceWith(10, "order_integrated");
  });
  it("flags late refunds for review, without executing the ERP synchronously", async () => {
    const response = await receiveAppmaxWebhook(
      request({ event: "order_refund", data: { order_id: 10 } }),
    );
    expect(response.status).toBe(202);
    expect(mocks.enqueueOrder).toHaveBeenCalledExactlyOnceWith(10, "order_refund");
    expect(mocks.processOrderOutbox).not.toHaveBeenCalled();
  });
  it("returns non-2xx on storage failure so Appmax retries", async () => {
    mocks.enqueueOrder.mockRejectedValueOnce(new Error("supabase offline"));
    expect(
      (await receiveAppmaxWebhook(request({ event: "order_integrated", data: { order_id: 10 } })))
        .status,
    ).toBe(503);
  });
  it("rejects malformed order IDs and ignores unrelated events", async () => {
    expect(
      (
        await receiveAppmaxWebhook(
          request({ event: "order_integrated", data: { order: { id: -1 } } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await receiveAppmaxWebhook(request({ event: "customer_created", data: { id: 10 } }))).status,
    ).toBe(200);
    expect(mocks.enqueueOrder).not.toHaveBeenCalled();
  });
  it("rejects foreign site events without enqueuing their IDs", async () => {
    const response = await receiveAppmaxWebhook(
      request({ event: "order_integrated", site_id: "other-merchant", data: { order_id: 10 } }),
    );
    expect(response.status).toBe(403);
    expect(mocks.enqueueOrder).not.toHaveBeenCalled();
  });
  it("rejects huge JSON before touching storage", async () => {
    expect(
      (
        await receiveAppmaxWebhook(
          request({
            event: "order_integrated",
            data: { order_id: 10, filler: "a".repeat(20_000) },
          }),
        )
      ).status,
    ).toBe(413);
  });
});

describe("protected outbox worker", () => {
  it("rejects unauthenticated callers without running jobs", async () => {
    expect((await receiveOrderWorker(request({}))).status).toBe(401);
    expect(mocks.processOrderOutbox).not.toHaveBeenCalled();
    expect(mocks.reconcileOrderOutbox).not.toHaveBeenCalled();
  });
  it("returns service unavailable if recovery storage is down, before claiming any orders", async () => {
    mocks.reconcileOrderOutbox.mockRejectedValueOnce(new Error("database down"));
    const response = await receiveOrderWorker(
      request({}, { authorization: "Bearer test-only-worker-secret" }),
    );
    expect(response.status).toBe(503);
    expect(mocks.processOrderOutbox).not.toHaveBeenCalled();
  });
  it("accepts exact secret and reports counts only", async () => {
    mocks.processOrderOutbox.mockResolvedValueOnce({
      claimed: 1,
      exported: 1,
      alreadyExported: 0,
      deferred: 0,
      failed: 0,
    });
    const response = await receiveOrderWorker(
      request({}, { authorization: "Bearer test-only-worker-secret" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ recovered: 2, exported: 1 });
    expect(mocks.reconcileOrderOutbox).toHaveBeenCalledWith(10);
  });
});
