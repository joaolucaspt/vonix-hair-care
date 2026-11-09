import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => ({
  monitor: "unit-test-only-monitor-secret-0123456789",
  service: "service-role-test-key",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ config }),
}));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    (
      ({
        ORDER_MONITOR_SECRET: values.monitor,
        SUPABASE_URL: "https://isolated-supabase.example",
        SUPABASE_SERVICE_ROLE_KEY: values.service,
      }) as Record<string, string>
    )[name] ?? "",
}));
import { receiveOrderHealth } from "@/routes/api.internal.order-health";
import { orderHealthSchema } from "@/lib/order-health.server";

const metrics = {
  pending: 4,
  leased: 1,
  completed: 54,
  awaitingReview: 2,
  readyToRetry: 3,
  expiredLeases: 0,
  multipleAttempts: 1,
  completedLast24h: 12,
  oldestPendingMinutes: 120,
};
const fetchMock = vi.fn();
function request(secret?: string): Request {
  return new Request("https://vonixhair.com/api/internal/order-health", {
    method: "POST",
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  values.monitor = "unit-test-only-monitor-secret-0123456789";
  values.service = "service-role-test-key";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(Response.json(metrics));
});

describe("protected and PII-free order health API", () => {
  it("rejects missing or incorrect secrets without touching storage", async () => {
    expect((await receiveOrderHealth(request())).status).toBe(401);
    expect((await receiveOrderHealth(request("incorrect"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed when the monitor secret is missing or too short", async () => {
    values.monitor = "";
    expect(
      (await receiveOrderHealth(request("unit-test-only-monitor-secret-0123456789"))).status,
    ).toBe(401);
    values.monitor = "short";
    expect((await receiveOrderHealth(request("short"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns only aggregates, with no order IDs or customer fields", async () => {
    const response = await receiveOrderHealth(request(values.monitor));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(metrics);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/rpc/vonix_order_health_summary"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ apikey: values.service }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(orderHealthSchema.safeParse({ ...metrics, email: "example@example.com" }).success).toBe(
      false,
    );
  });
  it("does not expose database errors or malformed metrics", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...metrics, pending: -1 }));
    expect((await receiveOrderHealth(request(values.monitor))).status).toBe(503);
    fetchMock.mockRejectedValueOnce(new Error("sensitive backend exception"));
    const response = await receiveOrderHealth(request(values.monitor));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive backend exception");
  });
});
