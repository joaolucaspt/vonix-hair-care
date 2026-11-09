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
  claimIntent: vi.fn(),
  advanceIntent: vi.fn(),
  finalizeIntent: vi.fn(),
  validStatus: vi.fn(() => false),
  idempotencySecret: "test-idempotency-secret-that-is-at-least-32-bytes",
  externalId: "test-external-id",
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/lib/env.server", () => ({
  env: (key: string) =>
    key === "CHECKOUT_IDEMPOTENCY_SECRET"
      ? mocks.idempotencySecret
      : key === "APPMAX_EXTERNAL_ID"
        ? mocks.externalId
        : "configured-for-unit-test",
}));
vi.mock("@/lib/checkout-idempotency.server", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  claimCheckoutIntent: mocks.claimIntent,
  advanceCheckoutIntent: mocks.advanceIntent,
  finalizeCheckoutIntent: mocks.finalizeIntent,
}));
vi.mock("@/lib/order-snapshot.server", () => ({ saveOrderSnapshot: mocks.saveSnapshot }));
vi.mock("@/lib/order-status-token.server", () => ({
  orderStatusToken: () => "signed-only-for-test",
  validOrderStatusToken: mocks.validStatus,
}));
vi.mock("@/lib/melhorenvio.server", () => ({ calculateShipping: mocks.shipping }));
vi.mock("@/lib/appmax.server", () => ({
  createCustomer: mocks.customer,
  createOrder: mocks.createOrder,
  payWithPix: mocks.pix,
  payWithCard: mocks.card,
  getOrder: mocks.status,
  isPaid: (o: { data: { order: { status: string } } }) =>
    ["aprovado", "integrado", "pendente_integracao"].includes(o.data.order.status),
}));
vi.mock("@/lib/affiliate-notify.server", () => ({ notifyAffiliateSale: mocks.affiliate }));

import {
  createPayment,
  getOrderStatus,
  quoteShipping,
  getPaymentConfig,
} from "@/lib/checkout.functions";

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
  mocks.claimIntent.mockResolvedValue({
    claimed: true,
    phase: "reserved",
    orderId: null,
    claimToken: "11111111-1111-4111-8111-111111111111",
  });
  mocks.advanceIntent.mockResolvedValue(undefined);
  mocks.finalizeIntent.mockResolvedValue(undefined);
  mocks.affiliate.mockResolvedValue(undefined);
  mocks.validStatus.mockReturnValue(false);
  mocks.idempotencySecret = "test-idempotency-secret-that-is-at-least-32-bytes";
  mocks.externalId = "test-external-id";
  mocks.card.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue({ data: { order: { id: 654, status: "autorizado" } } });
  mocks.pix.mockResolvedValue({
    pix_emv: "test-emv",
    pix_qrcode: "test-qr",
    pix_expiration_date: "2027-01-01",
  });
});

describe("server authoritative checkout", () => {
  it("keeps Pix/card unavailable until strong server-side idempotency is configured", async () => {
    mocks.idempotencySecret = "weak";
    const config = await getPaymentConfig({});
    expect(config.pixEnabled).toBe(false);
    expect(config.cardEnabled).toBe(false);
    const attempt = await createPayment({ data });
    expect(attempt).toMatchObject({ ok: false });
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
  });
  it("does not submit card charges if the card tokenization integration is unavailable", async () => {
    mocks.externalId = "";
    const config = await getPaymentConfig({});
    expect(config.pixEnabled).toBe(true);
    expect(config.cardEnabled).toBe(false);
    const result = await createPayment({
      data: { ...data, method: "card", token: "token-test-only" },
    });
    expect(result).toMatchObject({ ok: false });
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.card).not.toHaveBeenCalled();
  });
  it("shows only the free freight option for purchases above the threshold", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 1, name: "Expressa", company: "Correios", price: 30, days: 2 },
      { id: 2, name: "Economica", company: "Jadlog", price: 18, days: 5 },
      { id: 3, name: "Intermediaria", company: "Jadlog", price: 22, days: 4 },
    ]);
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(quote).toMatchObject({
      ok: true,
      options: [{ id: 2, price: 0, free: true }],
    });
    const bad = await createPayment({ data: { ...data, serviceId: 1 } });
    expect(bad).toMatchObject({
      ok: false,
      message: "Escolha uma opção de entrega válida.",
    });
    expect(mocks.customer).not.toHaveBeenCalled();
    const paid = await createPayment({ data: { ...data, serviceId: 2 } });
    expect(paid).toMatchObject({ ok: true, method: "pix" });
    expect(mocks.createOrder.mock.calls[0]?.[0]).toMatchObject({ shipping_value: 0 });
  });
  it("preserves fast/economy choices when free freight is not earned", async () => {
    const cheaper = getProduct("reparador-de-pontas")!;
    const small = {
      slug: cheaper.slug,
      variant: cheaper.variants[0]!.label,
      qty: 1,
    };
    mocks.shipping.mockResolvedValue([
      { id: 1, name: "Expressa", company: "Correios", price: 30, days: 2 },
      { id: 2, name: "Economica", company: "Jadlog", price: 18, days: 5 },
      { id: 3, name: "Intermediaria", company: "Jadlog", price: 22, days: 4 },
    ]);
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [small] } });
    expect(quote).toMatchObject({
      ok: true,
      options: [
        { id: 1, price: 30, free: false },
        { id: 2, price: 18, free: false },
      ],
    });
    const result = await createPayment({ data: { ...data, items: [small], serviceId: 2 } });
    expect(result).toMatchObject({ ok: true, method: "pix" });
    expect(mocks.createOrder.mock.calls[0]?.[0]).toMatchObject({ shipping_value: 1800 });
  });
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
  it("blocks a second identical attempt before creating another Appmax customer/order/payment", async () => {
    const first = await createPayment({ data });
    expect(first).toMatchObject({ ok: true, method: "pix", orderId: 654 });
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "submitted",
      orderId: 654,
      claimToken: null,
    });
    const second = await createPayment({ data });
    expect(second).toMatchObject({
      ok: true,
      method: "verification",
      orderId: 654,
      paid: false,
      status: "aguardando_confirmacao",
    });
    expect(mocks.customer).toHaveBeenCalledTimes(1);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.pix).toHaveBeenCalledTimes(1);
    expect(mocks.advanceIntent).toHaveBeenCalledTimes(4);
  });
  it("prevents switching from Pix to card to bypass the same pending purchase", async () => {
    const first = await createPayment({ data });
    expect(first).toMatchObject({ ok: true, method: "pix" });
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "submitted",
      orderId: 654,
      claimToken: null,
    });
    const second = await createPayment({
      data: { ...data, method: "card", token: "new-card-token" },
    });
    expect(second).toMatchObject({ ok: true, method: "verification", orderId: 654 });
    expect(mocks.claimIntent.mock.calls[0]![0]).toBe(mocks.claimIntent.mock.calls[1]![0]);
    expect(mocks.customer).toHaveBeenCalledTimes(1);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.pix).toHaveBeenCalledTimes(1);
    expect(mocks.card).not.toHaveBeenCalled();
  });
  it("blocks a second attempt even when the original request lost its Appmax order ID", async () => {
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "creating_order",
      orderId: null,
      claimToken: null,
    });
    const r = await createPayment({ data });
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/tentativa de compra em verificação/);
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("does not contact Appmax when reservation storage is unavailable", async () => {
    mocks.claimIntent.mockRejectedValueOnce(new Error("storage offline"));
    const r = await createPayment({ data });
    expect(r).toMatchObject({ ok: false });
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("never contacts Appmax after a lost state-machine fencing lease", async () => {
    mocks.advanceIntent.mockRejectedValueOnce(new Error("stale lease"));
    const r = await createPayment({ data });
    expect(r).toMatchObject({ ok: false });
    expect(mocks.customer).not.toHaveBeenCalled();
  });
  it("preserves order tracking rather than starting a new Pix on ambiguous network failure", async () => {
    mocks.pix.mockRejectedValueOnce(new Error("gateway timeout"));
    const r = await createPayment({ data });
    expect(r).toMatchObject({
      ok: true,
      method: "verification",
      orderId: 654,
      paid: false,
      status: "aguardando_confirmacao",
    });
    expect(mocks.pix).toHaveBeenCalledTimes(1);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });
  it("marks a payment completed only after authentic Appmax status says paid", async () => {
    mocks.validStatus.mockReturnValueOnce(true);
    mocks.status.mockResolvedValueOnce({ data: { order: { status: "aprovado", id: 654 } } });
    const status = await getOrderStatus({ data: { orderId: 654, statusToken: "a".repeat(43) } });
    expect(status).toMatchObject({ ok: true, paid: true, status: "aprovado" });
    expect(mocks.finalizeIntent).toHaveBeenCalledWith(654, "completed");
  });
  it("allows confirmed cancellation to unlock a new attempt, but not authorization", async () => {
    mocks.validStatus.mockReturnValue(true);
    mocks.status
      .mockResolvedValueOnce({ data: { order: { status: "autorizado", id: 654 } } })
      .mockResolvedValueOnce({ data: { order: { status: "cancelado", id: 654 } } });
    expect(
      await getOrderStatus({ data: { orderId: 654, statusToken: "a".repeat(43) } }),
    ).toMatchObject({ ok: true, paid: false, status: "autorizado" });
    expect(mocks.finalizeIntent).not.toHaveBeenCalled();
    expect(
      await getOrderStatus({ data: { orderId: 654, statusToken: "a".repeat(43) } }),
    ).toMatchObject({ ok: true, paid: false, status: "cancelado" });
    expect(mocks.finalizeIntent).toHaveBeenCalledWith(654, "cancelled");
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
