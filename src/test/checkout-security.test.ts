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
  resolveAffiliateCoupon: vi.fn(),
  saveSnapshot: vi.fn(),
  loadSnapshot: vi.fn(),
  claimIntent: vi.fn(),
  lookupIntent: vi.fn(),
  advanceIntent: vi.fn(),
  finalizeIntent: vi.fn(),
  validStatus: vi.fn(() => false),
  idempotencySecret: "test-idempotency-secret-that-is-at-least-32-bytes",
  externalId: "test-external-id",
  requestHeader: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: mocks.requestHeader }));
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
  lookupExistingCheckoutIntent: mocks.lookupIntent,
  advanceCheckoutIntent: mocks.advanceIntent,
  finalizeCheckoutIntent: mocks.finalizeIntent,
}));
vi.mock("@/lib/order-snapshot.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/order-snapshot.server")>()),
  saveOrderSnapshot: mocks.saveSnapshot,
  loadOrderSnapshot: mocks.loadSnapshot,
}));
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
vi.mock("@/lib/affiliate-coupon.server", () => ({
  resolveAffiliateCoupon: mocks.resolveAffiliateCoupon,
}));

import {
  createPayment,
  getOrderStatus,
  quoteShipping,
  getPaymentConfig,
  lookupCoupon,
  checkoutCustomerSchema,
  checkoutAddressSchema,
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
  mocks.loadSnapshot.mockImplementation(async () => mocks.saveSnapshot.mock.calls[0]?.[0]);
  mocks.lookupIntent.mockResolvedValue(null);
  mocks.claimIntent.mockResolvedValue({
    claimed: true,
    phase: "reserved",
    orderId: null,
    claimToken: "11111111-1111-4111-8111-111111111111",
  });
  mocks.advanceIntent.mockResolvedValue(undefined);
  mocks.finalizeIntent.mockResolvedValue(undefined);
  mocks.affiliate.mockResolvedValue(undefined);
  mocks.resolveAffiliateCoupon.mockResolvedValue(undefined);
  mocks.validStatus.mockReturnValue(false);
  mocks.idempotencySecret = "test-idempotency-secret-that-is-at-least-32-bytes";
  mocks.externalId = "test-external-id";
  mocks.requestHeader.mockReturnValue(undefined);
  mocks.card.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue({ data: { order: { id: 654, status: "autorizado" } } });
  mocks.pix.mockResolvedValue({
    pix_emv: "test-emv",
    pix_qrcode: "test-qr",
    pix_expiration_date: "2027-01-01",
  });
});

describe("server authoritative checkout", () => {
  it("valida DDD, UF brasileira e campos significativos antes de criar cliente", () => {
    expect(
      checkoutCustomerSchema.safeParse({ ...data.customer, whatsapp: "00000000000" }).success,
    ).toBe(false);
    expect(
      checkoutCustomerSchema.safeParse({ ...data.customer, whatsapp: "11912345678" }).success,
    ).toBe(true);
    expect(
      checkoutCustomerSchema.safeParse({ ...data.customer, whatsapp: "+55 (31) 98888-7777" }),
    ).toMatchObject({
      success: true,
      data: { whatsapp: "31988887777" },
    });
    expect(
      checkoutCustomerSchema.safeParse({ ...data.customer, whatsapp: "(31) 3333-4444" }),
    ).toMatchObject({
      success: true,
      data: { whatsapp: "3133334444" },
    });
    expect(
      checkoutCustomerSchema.safeParse({ ...data.customer, whatsapp: "abc31988887777" }).success,
    ).toBe(false);
    expect(checkoutCustomerSchema.safeParse({ ...data.customer, nome: "   " }).success).toBe(false);
    expect(checkoutAddressSchema.safeParse({ ...data.address, uf: "XX" }).success).toBe(false);
    expect(checkoutAddressSchema.safeParse({ ...data.address, rua: "   " }).success).toBe(false);
    expect(checkoutAddressSchema.safeParse({ ...data.address, numero: "   " }).success).toBe(false);
    expect(checkoutAddressSchema.safeParse({ ...data.address, cidade: "   " }).success).toBe(false);
    expect(checkoutAddressSchema.safeParse({ ...data.address, uf: "mg" })).toMatchObject({
      success: true,
      data: { uf: "MG" },
    });
  });
  it("não confia em cupom de afiliada sem confirmação no servidor", async () => {
    const couponCode = "MARISSOL10";
    expect(await lookupCoupon({ data: { code: couponCode } })).toEqual({ ok: false });
    const payment = await createPayment({ data: { ...data, coupon: couponCode } });
    expect(payment).toMatchObject({ ok: false, retrySafe: true });
    expect(mocks.resolveAffiliateCoupon).toHaveBeenCalledWith(couponCode);
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });

  it("revalida no servidor cupom de afiliada e rejeita preço inferior ao cotado antes da reserva", async () => {
    const couponCode = "MARISSOL10";
    mocks.resolveAffiliateCoupon.mockResolvedValue({
      code: couponCode,
      label: "Cupom confirmado no teste isolado",
      percent: 10,
    });
    expect(await lookupCoupon({ data: { code: couponCode } })).toMatchObject({
      ok: true,
      code: couponCode,
      percent: 10,
    });
    const result = await createPayment({
      data: { ...data, coupon: couponCode, quotedTotalCents: 1 },
    });
    expect(result).toMatchObject({ ok: false, retrySafe: true, reason: "price_changed" });
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });

  it("rejeita total informado que ficou defasado", async () => {
    const result = await createPayment({ data: { ...data, quotedTotalCents: 100 } });
    expect(result).toMatchObject({ ok: false, retrySafe: true });
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it("marca falha ambígua do backend como insegura para uma nova cobrança", async () => {
    mocks.claimIntent.mockRejectedValueOnce(new Error("storage temporarily unavailable"));
    const answer = await createPayment({ data });
    expect(answer).toMatchObject({ ok: false, retrySafe: false });
    expect(answer.message).toMatch(/antes de tentar pagar novamente/);
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("rejeita Plex fora de estoque antes de consultar frete ou pagamento", async () => {
    const unavailable = { slug: "plex-vonix", variant: "1000ml", qty: 1 };
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [unavailable] } });
    expect(quote).toMatchObject({
      ok: false,
      message: expect.stringMatching(/produto ou desconto do carrinho/),
    });
    const payment = await createPayment({ data: { ...data, items: [unavailable] } });
    expect(payment).toMatchObject({
      ok: false,
      retrySafe: true,
      message: expect.stringMatching(/Revise a sacola/),
    });
    expect(mocks.shipping).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("recalcula complemento de duas unidades com 12% e não marca falso SKU comp5 no pedido", async () => {
    const complement = getProduct("serum-argan")!;
    const variant = complement.variants[0]!;
    const items = [
      item,
      { slug: complement.slug, variant: variant.label, qty: 2, offer: "comp5" as const },
    ];
    const quote = await quoteShipping({ data: { cep: data.address.cep, items } });
    expect(quote.ok).toBe(true);
    const packageItems = mocks.shipping.mock.calls[0]?.[1] as {
      id: string;
      unitPrice: number;
      quantity: number;
    }[];
    expect(packageItems.find((i) => i.id === complement.slug)).toMatchObject({
      id: complement.slug,
      unitPrice: lineTotals(variant.price, 2).net / 2,
      quantity: 2,
    });
    const payment = await createPayment({ data: { ...data, items } });
    expect(payment).toMatchObject({ ok: true, method: "pix" });
    const appmaxProducts = mocks.createOrder.mock.calls[0]?.[0]?.products as {
      sku: string;
      name: string;
      unit_value: number;
    }[];
    expect(appmaxProducts.find((i) => i.name.includes(complement.name))?.sku).toBe(complement.slug);
    expect(appmaxProducts.find((i) => i.name.includes(complement.name))?.unit_value).toBe(
      Math.round(lineTotals(variant.price, 2).net * 100),
    );
  });

  it("rejeita SKU/variante repetidos no payload direto para evitar preço divergente", async () => {
    const items = [item, { ...item }];
    const quote = await quoteShipping({ data: { cep: data.address.cep, items } });
    expect(quote).toMatchObject({ ok: false, message: expect.stringMatching(/Revise a sacola/) });
    const payment = await createPayment({ data: { ...data, items } });
    expect(payment).toMatchObject({ ok: false, retrySafe: true });
    expect(mocks.shipping).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("rejeita complemento sem produto-base como erro seguro, sem tentativa de cobrança", async () => {
    const orphan = { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const };
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [orphan] } });
    expect(quote).toMatchObject({ ok: false, message: expect.stringMatching(/Revise a sacola/) });
    const payment = await createPayment({ data: { ...data, items: [orphan] } });
    expect(payment).toMatchObject({ ok: false, retrySafe: true });
    expect(mocks.shipping).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("bloqueia desconto de complemento em best-seller sem produto principal", async () => {
    const forged = { slug: "botox-vonix", variant: "1Kg", qty: 1, offer: "comp5" as const };
    const shipping = await quoteShipping({ data: { cep: data.address.cep, items: [forged] } });
    const payment = await createPayment({ data: { ...data, items: [forged] } });
    expect(shipping).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Revise a sacola/),
    });
    expect(payment).toMatchObject({ ok: false, retrySafe: true });
    expect(mocks.shipping).not.toHaveBeenCalled();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("records explicit marketing acceptance before calling a payment method", async () => {
    const answer = await createPayment({ data: { ...data, marketingConsent: true } });
    expect(answer).toMatchObject({ ok: true });
    const record = mocks.saveSnapshot.mock.calls[0]![0];
    expect(record.marketingConsent).toMatchObject({
      accepted: true,
      policyVersion: "v1",
      recordedAt: expect.any(String),
    });
    expect(new Date(record.marketingConsent.recordedAt).toISOString()).toBe(
      record.marketingConsent.recordedAt,
    );
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("records rejection when consent is missing or false without blocking the payment", async () => {
    const answer = await createPayment({ data });
    expect(answer).toMatchObject({ ok: true });
    expect(mocks.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        marketingConsent: expect.objectContaining({ accepted: false, policyVersion: "v1" }),
      }),
    );
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("never trusts a user-supplied IP when sending buyer data to Appmax", async () => {
    // Legacy browsers can still include "ip" in the POST request. Zod strips
    // it, and the checkout reads the IP only from the trusted edge.
    const submitted = {
      ...data,
      ip: "8.8.8.8",
    };
    mocks.requestHeader.mockImplementation((key: string) =>
      key === "cf-connecting-ip" ? "2001:db8::1234" : undefined,
    );
    expect(await createPayment({ data: submitted })).toMatchObject({ ok: true });
    const customer = mocks.customer.mock.calls[0]![0];
    expect(customer.ip).toBe("2001:db8::1234");
    expect(customer.ip).not.toBe("8.8.8.8");
  });
  it("falls back safely if the edge IP is malformed and ignores forwarded-for", async () => {
    mocks.requestHeader.mockImplementation((key: string) =>
      key === "cf-connecting-ip" ? "bad IP" : key === "x-forwarded-for" ? "1.2.3.4" : undefined,
    );
    expect(await createPayment({ data })).toMatchObject({ ok: true });
    const customer = mocks.customer.mock.calls[0]![0];
    expect(customer.ip).toBe("0.0.0.0");
  });
  it("rejects malformed provider quotes before presenting or charging freight", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 21, name: "Inválida", company: "Correios", price: -12, days: 3 },
      { id: 22, name: "Inválida", company: "Correios", price: Number.NaN, days: 3 },
      { id: 23, name: "Inválida", company: "Correios", price: 25, days: -1 },
      { id: 0, name: "Inválida", company: "Correios", price: 20, days: 3 },
    ]);
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(quote).toEqual({ ok: true, options: [] });
    const attempt = await createPayment({ data: { ...data, serviceId: 21 } });
    expect(attempt).toMatchObject({ ok: false, message: "Escolha uma opção de entrega válida." });
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });

  it("keeps a valid service even when mixed with malformed carrier quotes", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 21, name: "Inválida", company: "Correios", price: -12, days: 1 },
      { id: 23, name: "Normal", company: "Jadlog", price: 17.9, days: 4 },
    ]);
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(quote).toMatchObject({ ok: true, options: [{ id: 23, price: 0, free: true }] });
    expect(await createPayment({ data: { ...data, serviceId: 23 } })).toMatchObject({
      ok: true,
      method: "pix",
    });
    expect(mocks.createOrder.mock.calls[0]?.[0]).toMatchObject({ shipping_value: 0 });
  });

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
  it("prioritizes a validated option of up to 3 days for free freight", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 1, name: "Expressa", company: "Correios", price: 30, days: 2 },
      { id: 2, name: "Economica", company: "Jadlog", price: 18, days: 5 },
      { id: 3, name: "Intermediaria", company: "Jadlog", price: 22, days: 4 },
    ]);
    const quote = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(quote).toMatchObject({
      ok: true,
      options: [{ id: 1, price: 0, free: true }],
    });
    const bad = await createPayment({ data: { ...data, serviceId: 2 } });
    expect(bad).toMatchObject({
      ok: false,
      message: "Escolha uma opção de entrega válida.",
    });
    expect(mocks.customer).not.toHaveBeenCalled();
    const paid = await createPayment({ data: { ...data, serviceId: 1 } });
    expect(paid).toMatchObject({ ok: true, method: "pix" });
    expect(mocks.createOrder.mock.calls[0]?.[0]).toMatchObject({ shipping_value: 0 });
  });
  it("never chooses a malformed fast quote for free freight", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 1, name: "Falso rápido", company: "Correios", price: -8, days: 1 },
      { id: 2, name: "Econômico", company: "Jadlog", price: 18, days: 6 },
      { id: 3, name: "Rápido válido", company: "Correios", price: 27, days: 3 },
    ]);
    const result = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(result).toMatchObject({ ok: true, options: [{ id: 3, price: 0, days: 3, free: true }] });
    expect((await createPayment({ data: { ...data, serviceId: 1 } })).ok).toBe(false);
    expect(mocks.customer).not.toHaveBeenCalled();
  });

  it("uses a real slower deadline if no carrier serves the CEP in 3 days", async () => {
    mocks.shipping.mockResolvedValue([
      { id: 2, name: "Econômico", company: "Jadlog", price: 18, days: 6 },
      { id: 3, name: "Outra", company: "Correios", price: 27, days: 4 },
    ]);
    const result = await quoteShipping({ data: { cep: data.address.cep, items: [item] } });
    expect(result).toMatchObject({ ok: true, options: [{ id: 2, price: 0, days: 6, free: true }] });
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
    expect(sent["shipping_value"]).toBe(0); // validated free quote for an eligible cart
    expect(mocks.saveSnapshot).toHaveBeenCalledOnce();
    expect(mocks.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 654, shippingValueCents: 0 }),
    );
  });
  it("recupera o pedido ORIGINAL mesmo quando a cotação de frete cai depois do primeiro Pix", async () => {
    const first = await createPayment({ data });
    expect(first).toMatchObject({ ok: true, method: "pix", orderId: 654 });
    mocks.shipping.mockRejectedValueOnce(new Error("transportadora indisponível"));
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "submitted",
      orderId: 654,
      updatedAt: new Date().toISOString(),
    });
    const replay = await createPayment({ data });
    expect(replay).toMatchObject({
      ok: true,
      method: "verification",
      orderId: 654,
      total: first.ok ? first.total : undefined,
      paid: false,
    });
    expect(mocks.lookupIntent).toHaveBeenCalledOnce();
    expect(mocks.lookupIntent.mock.calls[0]![0]).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.claimIntent).toHaveBeenCalledOnce();
    expect(mocks.customer).toHaveBeenCalledOnce();
    expect(mocks.createOrder).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("responde erro seguro quando frete cai em compra nova, sem criar reserva de pagamento", async () => {
    mocks.shipping.mockRejectedValueOnce(new Error("carrier offline"));
    const response = await createPayment({ data });
    expect(response).toMatchObject({ ok: false, retrySafe: true });
    expect(response.message).toMatch(/entrega agora/);
    expect(mocks.lookupIntent).toHaveBeenCalledOnce();
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("recupera pedido existente quando a transportadora removeu a opção selecionada", async () => {
    const first = await createPayment({ data });
    expect(first).toMatchObject({ ok: true, orderId: 654 });
    mocks.shipping.mockResolvedValueOnce([
      { id: 12, name: "Outra", company: "Correios", price: 79, days: 9 },
    ]);
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "charging",
      orderId: 654,
      updatedAt: new Date().toISOString(),
    });
    const replay = await createPayment({ data });
    expect(replay).toMatchObject({ ok: true, method: "verification", orderId: 654 });
    expect(mocks.claimIntent).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("recupera pedido reservado mesmo se o comprador alterou o cupom para um código expirado", async () => {
    await createPayment({ data });
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "submitted",
      orderId: 654,
      updatedAt: new Date().toISOString(),
    });
    const replay = await createPayment({ data: { ...data, coupon: "CUPOM-INVALIDO" } });
    expect(replay).toMatchObject({ ok: true, method: "verification", orderId: 654 });
    expect(mocks.claimIntent).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("não mascara um novo pagamento com um pedido cancelado ou encerrado há mais de 24 horas", async () => {
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "cancelled",
      orderId: 654,
      updatedAt: new Date().toISOString(),
    });
    expect(await createPayment({ data: { ...data, serviceId: 999 } })).toMatchObject({
      ok: false,
      retrySafe: true,
    });
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "completed",
      orderId: 654,
      updatedAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
    });
    expect(await createPayment({ data: { ...data, serviceId: 999 } })).toMatchObject({
      ok: false,
      retrySafe: true,
    });
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });
  it("nunca cria cobrança nem mostra valor quando a recuperação só encontra reserva sem pedido", async () => {
    mocks.shipping.mockRejectedValueOnce(new Error("carrier offline"));
    mocks.lookupIntent.mockResolvedValueOnce({
      phase: "creating_order",
      orderId: null,
      updatedAt: new Date().toISOString(),
    });
    const response = await createPayment({ data });
    expect(response).toMatchObject({ ok: false, retrySafe: false });
    expect(response).not.toHaveProperty("total");
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
  });
  it("falha fechado se banco de recuperação não responde durante queda da transportadora", async () => {
    mocks.shipping.mockRejectedValueOnce(new Error("carrier offline"));
    mocks.lookupIntent.mockRejectedValueOnce(new Error("database offline"));
    const response = await createPayment({ data });
    expect(response).toMatchObject({ ok: false, retrySafe: false });
    expect(mocks.claimIntent).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.pix).not.toHaveBeenCalled();
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
  it("mostra valor ORIGINAL no pedido duplicado, não a cotação atual", async () => {
    const cheap = getProduct("reparador-de-pontas")!;
    const small = { slug: cheap.slug, variant: cheap.variants[0]!.label, qty: 1 };
    mocks.shipping.mockResolvedValue([
      { id: 42, name: "Econômica", company: "Correios", price: 18.75, days: 5 },
    ]);
    const first = await createPayment({ data: { ...data, items: [small] } });
    expect(first).toMatchObject({ ok: true, method: "pix", orderId: 654 });
    const snapshot = mocks.saveSnapshot.mock.calls[0]![0];
    const originalCents =
      snapshot.products.reduce(
        (total: number, x: { unitValueCents: number; quantity: number }) =>
          total + x.unitValueCents * x.quantity,
        0,
      ) +
      snapshot.shippingValueCents -
      snapshot.discountValueCents;
    mocks.shipping.mockResolvedValue([
      { id: 42, name: "Nova tarifa", company: "Correios", price: 59.95, days: 7 },
    ]);
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "submitted",
      orderId: 654,
      claimToken: null,
    });
    const replay = await createPayment({
      data: { ...data, items: [small], method: "card", token: "synthetic-card-token" },
    });
    expect(replay).toMatchObject({
      ok: true,
      method: "verification",
      orderId: 654,
      total: originalCents / 100,
      paid: false,
    });
    expect(mocks.loadSnapshot).toHaveBeenCalledExactlyOnceWith(654);
    expect(mocks.customer).toHaveBeenCalledOnce();
    expect(mocks.createOrder).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
    expect(mocks.card).not.toHaveBeenCalled();
  });
  it("não inventa total nem permite nova cobrança se snapshot original estiver indisponível", async () => {
    await createPayment({ data });
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "submitted",
      orderId: 654,
      claimToken: null,
    });
    mocks.loadSnapshot.mockRejectedValueOnce(new Error("synthetic database unavailable"));
    const replay = await createPayment({ data });
    expect(replay).toMatchObject({ ok: false, retrySafe: false });
    expect(replay.message).toMatch(/atendimento antes de tentar pagar novamente/);
    expect(replay).not.toHaveProperty("total");
    expect(mocks.customer).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
  });
  it("não usa snapshot de outro pedido para anunciar total de compra", async () => {
    await createPayment({ data });
    mocks.claimIntent.mockResolvedValueOnce({
      claimed: false,
      phase: "submitted",
      orderId: 654,
      claimToken: null,
    });
    mocks.loadSnapshot.mockResolvedValueOnce({
      ...mocks.saveSnapshot.mock.calls[0]![0],
      orderId: 777,
    });
    const replay = await createPayment({ data });
    expect(replay).toMatchObject({ ok: false, retrySafe: false });
    expect(replay).not.toHaveProperty("total");
    expect(mocks.createOrder).toHaveBeenCalledOnce();
    expect(mocks.pix).toHaveBeenCalledOnce();
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
