import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct, lineTotals } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  customer: vi.fn(),
  createOrder: vi.fn(),
  pix: vi.fn(),
  card: vi.fn(),
  shipping: vi.fn(),
  status: vi.fn(),
  affiliate: vi.fn(),
  saveSnapshot: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/lib/env.server", () => ({ env: () => "configured-for-unit-test" }));
vi.mock("@/lib/order-snapshot.server", () => ({ saveOrderSnapshot: mocks.saveSnapshot }));
vi.mock("@/lib/order-status-token.server", () => ({
  orderStatusToken: () => "signed-only-for-test",
  validOrderStatusToken: () => false,
}));
vi.mock("@/lib/melhorenvio.server", () => ({ calculateShipping: mocks.shipping }));
vi.mock("@/lib/appmax.server", () => ({
  createCustomer: mocks.customer,
  createOrder: mocks.createOrder,
  payWithPix: mocks.pix,
  payWithCard: mocks.card,
  getOrder: mocks.status,
  isPaid: () => true,
}));
vi.mock("@/lib/affiliate-notify.server", () => ({ notifyAffiliateSale: mocks.affiliate }));

import { createPayment, getOrderStatus, quoteShipping } from "@/lib/checkout.functions";

const p = getProduct("kit-banana-e-mel")!;
const v = p.variants[0]!;
const item = { slug: p.slug, variant: v.label, qty: 1 };
const data = {
  customer: {
    nome: "Cliente Exemplo",
    email: "example@example.com",
    cpf: "52998224725",
    whatsapp: "31988887777",
  },
  address: {
    cep: "30140010",
    rua: "Rua Teste",
    numero: "1",
    bairro: "Centro",
    cidade: "Belo Horizonte",
    uf: "MG",
  },
  items: [item],
  serviceId: 42,
  method: "pix" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shipping.mockResolvedValue([
    { id: 42, name: "PAC", company: "Correios", price: 20, days: 5 },
  ]);
  mocks.customer.mockResolvedValue(321);
  mocks.createOrder.mockResolvedValue(654);
  mocks.saveSnapshot.mockResolvedValue(undefined);
  mocks.card.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue({ data: { order: { id: 654, status: "autorizado" } } });
  mocks.pix.mockResolvedValue({
    pix_emv: "test-emv",
    pix_qrcode: "test-qr",
    pix_expiration_date: "2027-01-01",
  });
});

describe("server authoritative checkout", () => {
  it("never sends both products_value and unit_value to Appmax", async () => {
    const result = await createPayment({ data });
    expect(result).toMatchObject({ ok: true, method: "pix", orderId: 654 });
    const sent = mocks.createOrder.mock.calls[0]![0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("products_value");
    expect(sent).toHaveProperty("products");
    const products = sent["products"] as { unit_value: number }[];
    expect(products[0]?.unit_value).toBe(Math.round(lineTotals(v.price, 1).net * 100));
    expect(sent["shipping_value"]).toBe(0); // cheapest quote is free above R$ 150
    expect(mocks.saveSnapshot).toHaveBeenCalledOnce();
    expect(mocks.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 654, shippingValueCents: 0 }),
    );
  });
  it("never generates a Pix if the server cannot save the order snapshot", async () => {
    mocks.saveSnapshot.mockRejectedValueOnce(new Error("storage offline"));
    const response = await createPayment({ data });
    expect(response).toMatchObject({ ok: false });
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.saveSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("never reports a card payment as declined merely because gateway confirmation timed out", async () => {
    mocks.card.mockRejectedValueOnce(new Error("network timeout"));
    const r = await createPayment({ data: { ...data, method: "card", token: "token-test" } });
    expect(r).toMatchObject({
      ok: true,
      method: "card",
      orderId: 654,
      paid: false,
      status: "verificacao_necessaria",
    });
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.card).toHaveBeenCalledTimes(1);
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("preserves the order reference if post-charge status polling is unavailable", async () => {
    mocks.status.mockRejectedValueOnce(new Error("status timeout"));
    const r = await createPayment({ data: { ...data, method: "card", token: "token-test" } });
    expect(r).toMatchObject({
      ok: true,
      method: "card",
      orderId: 654,
      paid: false,
      status: "aguardando_confirmacao",
    });
    expect(mocks.card).toHaveBeenCalledTimes(1);
    expect(mocks.status).toHaveBeenCalledTimes(1);
  });
  it("denies forged complement discounts without a real eligible base product", async () => {
    const invalid = await createPayment({
      data: { ...data, items: [{ ...item, offer: "comp5" as const }] },
    });
    expect(invalid).toMatchObject({ ok: false });
    expect(mocks.customer).not.toHaveBeenCalled();
    const quote = await quoteShipping({
      data: { cep: "30140010", items: [{ ...item, offer: "comp5" as const }] },
    });
    expect(quote).toMatchObject({ ok: false });
  });
  it("does not query arbitrary order IDs without a valid signed status capability", async () => {
    const r = await getOrderStatus({ data: { orderId: 111, statusToken: "a".repeat(43) } });
    expect(r).toMatchObject({ ok: false });
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
