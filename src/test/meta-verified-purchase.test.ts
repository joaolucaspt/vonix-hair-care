import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: "fake-meta-token", snapshot: vi.fn() }));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) => (key === "META_CAPI_TOKEN" ? mocks.token : ""),
}));
vi.mock("@/lib/analytics", () => ({ META_PIXEL_ID: "12345" }));
vi.mock("@/lib/store", () => ({ SITE_URL: "https://vonixhair.com" }));
vi.mock("@/lib/order-snapshot.server", () => ({ loadOrderSnapshot: mocks.snapshot }));
vi.mock("@/lib/appmax.server", () => ({
  isPaid: (o: { data: { order: { status: string } } }) =>
    ["aprovado", "integrado", "pendente_integracao"].includes(o.data.order.status),
}));
import { sendMetaEvent, sendVerifiedPurchase } from "@/lib/meta-capi.server";

const order = (status: string) => ({ data: { order: { id: 5501, status } } });
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "fake-meta-token";
  mocks.snapshot.mockResolvedValue({
    orderId: 5501,
    products: [{ sku: "test-product", unitValueCents: 15490, quantity: 1 }],
    shippingValueCents: 1200,
    discountValueCents: 490,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
});

describe("Meta CAPI must not count unverified purchases", () => {
  it("sends a paid order using the same stable eventID as Pixel", async () => {
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("sent");
    expect(mocks.snapshot).toHaveBeenCalledWith(5501);
    expect(fetchMock).toHaveBeenCalledOnce();
    const req = fetchMock.mock.calls[0]![1];
    const data = JSON.parse(req.body).data[0];
    expect(data.event_name).toBe("Purchase");
    expect(data.event_id).toBe("purchase-5501");
    expect(data.custom_data).toMatchObject({ currency: "BRL", value: 162 });
    expect(JSON.stringify(data)).not.toContain("529982");
    expect(req.signal).toBeInstanceOf(AbortSignal);
  });
  it("does not emit server Purchase for antifraud authorization or cancellation", async () => {
    expect(await sendVerifiedPurchase(order("autorizado") as never)).toBe("skipped");
    expect(await sendVerifiedPurchase(order("cancelado") as never)).toBe("skipped");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed on URLs impersonating the store domain", async () => {
    const result = await sendMetaEvent({
      event: "Lead",
      eventId: "lead-1",
      url: "https://vonixhair.com.attacker.example/checkout",
    });
    expect(result).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("skips server events without a configured Meta token", async () => {
    mocks.token = "";
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("skipped");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
