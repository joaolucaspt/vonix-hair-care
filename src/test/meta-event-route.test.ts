import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ config }),
}));
vi.mock("@/lib/meta-capi.server", () => ({ sendMetaEvent: mocks.send }));
import { receiveMetaEvent } from "@/routes/api.public.meta-event";

const req = (body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Request("https://vonixhair.com/api/public/meta-event", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://vonixhair.com", "sec-fetch-site": "same-origin", ...extraHeaders },
    body: JSON.stringify(body && typeof body === "object" && !Array.isArray(body) ? { consent: true, ...body } : body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue("sent");
});

describe("public Meta CAPI endpoint", () => {
  it("refuses forged Purchase conversions from browsers", async () => {
    const response = await receiveMetaEvent(
      req({
        event: "Purchase",
        eventId: "purchase-984",
        url: "https://vonixhair.com/checkout",
        customData: { currency: "BRL", value: 999999 },
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("continues to send legitimate public shopping events", async () => {
    const response = await receiveMetaEvent(
      req({
        event: "AddToCart",
        eventId: "add-test-1",
        url: "https://vonixhair.com/produto/item",
        customData: { currency: "BRL", value: 49.9 },
      }),
    );
    expect(response.status).toBe(204);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "AddToCart",
        eventId: "add-test-1",
      }),
    );
  });
  it("rejects malformed and unknown events", async () => {
    expect(
      (
        await receiveMetaEvent(
          req({ event: "PurchaseApproved", eventId: "x", url: "https://vonixhair.com" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await receiveMetaEvent(req({ event: "Lead", eventId: "", url: "https://vonixhair.com" })))
        .status,
    ).toBe(400);
    expect((await receiveMetaEvent(req([]))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("blocks events when the visitor did not explicitly accept optional tracking", async () => {
    const response = await receiveMetaEvent(req({
      consent: false, event: "AddToCart", eventId: "cart-2", url: "https://vonixhair.com/loja",
    }));
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("blocks calls from other origins or cross-site fetches", async () => {
    const body = { event: "PageView", eventId: "page-2", url: "https://vonixhair.com/loja" };
    expect((await receiveMetaEvent(req(body, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await receiveMetaEvent(req(body, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await receiveMetaEvent(req(body, { origin: "", "sec-fetch-site": "" }))).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects a claimed event from another site's URL even with matching request headers", async () => {
    const response = await receiveMetaEvent(req({
      event: "ViewContent", eventId: "view-2", url: "https://vonixhair.com.evil.example/product",
    }));
    expect(response.status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects forged prices, excessive items and arbitrary customer data", async () => {
    const base = { event: "AddToCart", eventId: "cart-3", url: "https://vonixhair.com/loja" };
    for (const customData of [
      { currency: "USD", value: 20 },
      { currency: "BRL", value: -1 },
      { currency: "BRL", value: "999999" },
      { currency: "BRL", value: 20, cpf: "SENSITIVE_NOT_ALLOWED" },
      { currency: "BRL", contents: [{ id: "SKU", quantity: -4, item_price: 20 }] },
      { currency: "BRL", content_ids: Array.from({ length: 41 }, (_, index) => String(index)) },
    ]) {
      expect((await receiveMetaEvent(req({ ...base, customData }))).status).toBe(400);
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not trust a client-provided X-Forwarded-For address", async () => {
    const event = { event: "PageView", eventId: "page-4", url: "https://vonixhair.com" };
    expect((await receiveMetaEvent(req(event, { "x-forwarded-for": "203.0.113.99" }))).status).toBe(204);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ ip: undefined }));
    mocks.send.mockClear();
    expect((await receiveMetaEvent(req(event, { "cf-connecting-ip": "198.51.100.12" }))).status).toBe(204);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ ip: "198.51.100.12" }));
  });

  it("rejects oversized payloads before accessing Meta APIs", async () => {
    const response = await receiveMetaEvent(
      req({
        event: "AddToCart",
        eventId: "x",
        url: "https://vonixhair.com",
        garbage: "a".repeat(20_000),
      }),
    );
    expect(response.status).toBe(413);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
