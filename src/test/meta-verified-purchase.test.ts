import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  token: "fake-meta-token",
  snapshot: vi.fn(),
  claim: vi.fn(),
  ack: vi.fn(),
}));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) => (key === "META_CAPI_TOKEN" ? mocks.token : ""),
}));
vi.mock("@/lib/analytics", () => ({ META_PIXEL_ID: "12345" }));
vi.mock("@/lib/store", () => ({ SITE_URL: "https://vonixhair.com" }));
vi.mock("@/lib/order-snapshot.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/order-snapshot.server")>()),
  loadOrderSnapshot: mocks.snapshot,
}));
vi.mock("@/lib/meta-purchase-delivery.server", () => ({
  claimMetaPurchase: mocks.claim,
  acknowledgeMetaPurchase: mocks.ack,
}));
vi.mock("@/lib/appmax.server", () => ({
  isPaid: (o: { data: { order: { status: string } } }) =>
    ["aprovado", "integrado", "pendente_integracao"].includes(o.data.order.status),
}));
import { sendMetaEvent, sendVerifiedPurchase } from "@/lib/meta-capi.server";

const order = (status: string) => ({
  data: { order: { id: 5501, status }, payment: { paid_at: new Date().toISOString() } },
});
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "fake-meta-token";
  mocks.claim.mockResolvedValue("11111111-1111-4111-8111-111111111111");
  mocks.ack.mockResolvedValue(undefined);
  mocks.snapshot.mockResolvedValue({
    orderId: 5501,
    customer: {
      name: "Synthetic Buyer",
      email: "synthetic@example.test",
      phone: "31988887777",
      documentNumber: "52998224725",
    },
    address: {
      street: "Rua Teste", number: "12", complement: "",
      district: "Centro", city: "Belo Horizonte", state: "MG",
      postcode: "30140010",
    },
    products: [{ sku: "test-product", name: "Produto sintético", unitValueCents: 15490, quantity: 1 }],
    shippingValueCents: 1200,
    discountValueCents: 490,
    marketingConsent: { accepted: true, policyVersion: "v1", recordedAt: "2026-11-09T15:00:00.000Z" },
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(
    Response.json({ events_received: 1, messages: [], fbtrace_id: "test-only" }),
  );
});

describe("Meta CAPI must not count unverified purchases", () => {
  it("sends a paid order using the same stable eventID as Pixel", async () => {
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("sent");
    expect(mocks.snapshot).toHaveBeenCalledWith(5501);
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith(5501);
    expect(mocks.ack).toHaveBeenCalledExactlyOnceWith(5501, "11111111-1111-4111-8111-111111111111");
    expect(fetchMock).toHaveBeenCalledOnce();
    const req = fetchMock.mock.calls[0]![1];
    const data = JSON.parse(req.body).data[0];
    expect(data.event_name).toBe("Purchase");
    expect(data.event_id).toBe("purchase-5501");
    expect(data.custom_data).toMatchObject({ currency: "BRL", value: 162 });
    expect(JSON.stringify(data)).not.toContain("529982");
    expect(req.signal).toBeInstanceOf(AbortSignal);
  });
  it("does not call Meta or claim a delivery for a legacy paid order with no recorded consent", async () => {
    mocks.snapshot.mockResolvedValueOnce({
      orderId: 5501,
      products: [{ sku: "test-product", unitValueCents: 15490, quantity: 1 }],
      shippingValueCents: 1200,
      discountValueCents: 490,
    });
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("skipped");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends a paid Purchase if the buyer refused optional marketing at checkout", async () => {
    const legacy = {
      orderId: 5501,
      products: [{ sku: "test-product", unitValueCents: 15490, quantity: 1 }],
      shippingValueCents: 1200,
      discountValueCents: 490,
    };
    mocks.snapshot.mockResolvedValueOnce({
      ...legacy,
      marketingConsent: { accepted: false, policyVersion: "v1", recordedAt: "2026-11-09T15:00:00.000Z" },
    });
    expect(await sendVerifiedPurchase(order("integrado") as never)).toBe("skipped");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not accept a record using an unknown consent policy version", async () => {
    mocks.snapshot.mockResolvedValueOnce({
      orderId: 5501,
      products: [{ sku: "test-product", unitValueCents: 15490, quantity: 1 }],
      shippingValueCents: 1200,
      discountValueCents: 490,
      marketingConsent: { accepted: true, policyVersion: "v0", recordedAt: "2026-11-09T15:00:00.000Z" },
    });
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("skipped");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a paid Purchase without a merchant-confirmed paid_at, before claiming delivery", async () => {
    const missing = { data: { order: { id: 5501, status: "aprovado" } } };
    expect(await sendVerifiedPurchase(missing as never)).toBe("skipped");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a local-time paid_at with no offset instead of inventing today's attribution", async () => {
    const withoutOffset = {
      data: { order: { id: 5501, status: "integrado" }, payment: { paid_at: "2026-11-09T12:30:00" } },
    };
    expect(await sendVerifiedPurchase(withoutOffset as never)).toBe("skipped");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the merchant-confirmed paid_at time instead of the recovery time when available", async () => {
    const paidAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const paidOrder = {
      data: { order: { id: 5501, status: "aprovado" }, payment: { paid_at: paidAt } },
    };
    expect(await sendVerifiedPurchase(paidOrder as never)).toBe("sent");
    const data = JSON.parse(fetchMock.mock.calls[0]![1].body).data[0];
    expect(data.event_time).toBe(Math.floor(Date.parse(paidAt) / 1000));
  });
  it("does not invent a current-day conversion for a payment confirmed too long ago", async () => {
    const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const paidOrder = {
      data: { order: { id: 5501, status: "aprovado" }, payment: { paid_at: stale } },
    };
    expect(await sendVerifiedPurchase(paidOrder as never)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not emit server Purchase for antifraud authorization or cancellation", async () => {
    expect(await sendVerifiedPurchase(order("autorizado") as never)).toBe("skipped");
    expect(await sendVerifiedPurchase(order("cancelado") as never)).toBe("skipped");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not resend a paid Purchase after durable delivery is already confirmed", async () => {
    mocks.claim.mockResolvedValueOnce(null);
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("skipped");
    expect(mocks.claim).toHaveBeenCalledExactlyOnceWith(5501);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not mark a delivery sent when Graph returns HTTP 200 but zero accepted events", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ events_received: 0, messages: [] }));
    expect(await sendVerifiedPurchase(order("integrado") as never)).toBe("failed");
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not mark a delivery sent on HTTP 200 without a valid Meta acknowledgement", async () => {
    fetchMock.mockResolvedValueOnce(new Response("invalid body", { status: 200 }));
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("failed");
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not acknowledge a failed Meta Graph request as delivered", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    expect(await sendVerifiedPurchase(order("integrado") as never)).toBe("failed");
    expect(mocks.claim).toHaveBeenCalledOnce();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not report durable success if provider succeeded but database ACK failed", async () => {
    mocks.ack.mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("failed");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.ack).toHaveBeenCalledOnce();
  });
  it("never calls Meta when the delivery claim fails", async () => {
    mocks.claim.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await sendVerifiedPurchase(order("aprovado") as never)).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
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
