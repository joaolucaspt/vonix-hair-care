import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    name === "SUPABASE_URL"
      ? "https://snapshot-test.example"
      : name === "SUPABASE_SERVICE_ROLE_KEY"
        ? "service-role-unit-test-only"
        : "",
}));
import { loadOrderSnapshot, saveOrderSnapshot, snapshotTotalCents } from "@/lib/order-snapshot.server";
const snapshot = {
  orderId: 3501,
  customer: {
    name: "Pessoa Teste",
    email: "test@example.com",
    phone: "31999990000",
    documentNumber: "52998224725",
  },
  address: {
    street: "Rua Teste",
    number: "10",
    complement: "",
    district: "Centro",
    city: "Belo Horizonte",
    state: "MG",
    postcode: "30140010",
  },
  products: [
    { sku: "kit-banana-e-mel", name: "Combo Banana e Mel", quantity: 1, unitValueCents: 15490 },
  ],
  shippingValueCents: 0,
  discountValueCents: 774,
  marketingConsent: { accepted: true, policyVersion: "v1" as const, recordedAt: "2026-11-09T15:00:00.000Z" },
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("durable server-side Appmax order snapshots", () => {
  it("calcula o total original em centavos a partir do snapshot imutável", () => {
    expect(snapshotTotalCents(snapshot)).toBe(15490 - 774);
    expect(snapshotTotalCents({
      ...snapshot, shippingValueCents: 1250, discountValueCents: 490,
    })).toBe(15490 + 1250 - 490);
  });
  it("rejeita subtotal inconsistente, zero e overflow sem estimar valores", () => {
    expect(() => snapshotTotalCents({ ...snapshot, discountValueCents: 15490 })).toThrow();
    expect(() => snapshotTotalCents({ ...snapshot, discountValueCents: 15491 })).toThrow();
    expect(() => snapshotTotalCents({
      ...snapshot,
      products: [
        { sku: "fake", name: "synthetic", quantity: 99, unitValueCents: Number.MAX_SAFE_INTEGER },
      ],
    })).toThrow();
  });
  it("persists server-priced products and destination before collecting payment", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await saveOrderSnapshot(snapshot);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/rest/v1/vonix_order_snapshots");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      apikey: "service-role-unit-test-only",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    });
    expect(JSON.parse(init.body)).toEqual({ order_id: 3501, payload: snapshot });
  });
  it("loads only a snapshot matching the exact requested order", async () => {
    fetchMock.mockImplementation(async () => Response.json([{ payload: snapshot }]));
    expect(await loadOrderSnapshot(3501)).toEqual(snapshot);
    expect(fetchMock.mock.calls[0]![0]).toContain("order_id=eq.3501");
    await expect(loadOrderSnapshot(3502)).rejects.toThrow("Snapshot de outro pedido");
  });
  it("loads legacy snapshots but never invents consent for an old order", async () => {
    const { marketingConsent: _unused, ...legacy } = snapshot;
    fetchMock.mockImplementation(async () => Response.json([{ payload: legacy }]));
    const loaded = await loadOrderSnapshot(3501);
    expect(loaded.marketingConsent).toBeUndefined();
  });
  it("rejects malformed consent policy metadata before saving a paid order snapshot", async () => {
    await expect(saveOrderSnapshot({
      ...snapshot,
      marketingConsent: { accepted: true, policyVersion: "v0", recordedAt: "2026-11-09T15:00:00.000Z" } as never,
    })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed if a customer record is missing", async () => {
    fetchMock.mockResolvedValue(Response.json([]));
    await expect(loadOrderSnapshot(3501)).rejects.toThrow("Pedido sem snapshot");
  });
  it("never acknowledges unsuccessful storage writes", async () => {
    fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(saveOrderSnapshot(snapshot)).rejects.toThrow("Snapshot write HTTP 503");
  });
});
