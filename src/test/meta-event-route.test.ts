import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => ({ config }),
}));
vi.mock("@/lib/meta-capi.server", () => ({ sendMetaEvent: mocks.send }));
import { receiveMetaEvent } from "@/routes/api.public.meta-event";

const req = (body: unknown) =>
  new Request("https://vonixhair.com/api/public/meta-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
