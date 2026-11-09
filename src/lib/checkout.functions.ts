import { createServerFn } from "@tanstack/react-start";
import { isIP } from "node:net";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import * as appmax from "./appmax.server";
import { isValidCpf } from "./cpf";
import { env } from "./env.server";
import { orderStatusToken, validOrderStatusToken } from "./order-status-token.server";
import { saveOrderSnapshot } from "./order-snapshot.server";
import {
  checkoutFingerprint,
  claimCheckoutIntent,
  advanceCheckoutIntent,
  finalizeCheckoutIntent,
} from "./checkout-idempotency.server";
import { calculateShipping } from "./melhorenvio.server";
import { pickFreeShipping, pickTwoShipping } from "./shipping-pick";
import { normalizeRef, refCampaign } from "./affiliate-ref";
import { notifyAffiliateSale } from "./affiliate-notify.server";
import { checkoutTotals, complementsFor, getProduct, lineTotals, type Offer } from "./store";
import { couponCheck, couponFreeShipping, couponPercent, findCoupon } from "./coupons";

const itemSchema = z.object({
  slug: z.string().min(1).max(120),
  variant: z.string().min(1).max(120),
  qty: z.number().int().min(1).max(99),
  offer: z.enum(["comp5", "kit2", "kit3"]).optional(),
});
const cepSchema = z.string().regex(/^\d{5}-?\d{3}$/);

/** Prices always come from the catalog on the server; the browser only sends what is in the cart. */
function buildLines(items: z.infer<typeof itemSchema>[]) {
  // Validate that complement discounts are among recommendations for the other items.
  const baseProducts = items.filter((i) => i.offer !== "comp5").map((i) => i.slug);
  const eligible = new Set(baseProducts.length ? complementsFor(baseProducts).map((p) => p.slug) : []);
  if (items.some((i) => i.offer === "comp5" && !eligible.has(i.slug))) {
    throw new Error("Complemento promocional indisponível para este carrinho");
  }
  return items.map((i) => {
    const p = getProduct(i.slug);
    const v = p?.variants.find((x) => x.label === i.variant);
    if (!p || !v) throw new Error(`Produto indisponível: ${i.slug}`);
    const t = lineTotals(v.price, i.qty, i.offer as Offer | undefined);
    return { product: p, variant: v.label, offer: i.offer as Offer | undefined, ...t };
  });
}

const staleCartMessage =
  "Um produto ou desconto do carrinho não está disponível. Revise a sacola antes de continuar.";

const cents = (v: number) => Math.round(v * 100);

const couponSchema = z.string().max(30).optional();

async function shippingOptions(
  cep: string,
  lines: ReturnType<typeof buildLines>,
  couponCode?: string,
) {
  const quotes = await calculateShipping(
    cep,
    lines.map((l) => ({ id: l.product.slug, unitPrice: l.net / l.units, quantity: l.units })),
  );
  const t = checkoutTotals(lines, "pix");
  const free = t.freeShipping || couponFreeShipping(findCoupon(couponCode), t.gross);
  // Keep invalid carrier quotes out of the price calculation.
  const usable = quotes.filter(
    (q) =>
      Number.isSafeInteger(q.id) &&
      q.id > 0 &&
      Number.isFinite(q.price) &&
      q.price >= 0 &&
      q.price <= 100_000 &&
      Number.isInteger(q.days) &&
      q.days >= 0 &&
      q.days <= 365,
  );
  if (free) {
    // Prefer a quote of up to 3 business days, without inventing an ETA.
    const chosen = pickFreeShipping(usable);
    return chosen ? [{ ...chosen, free: true, price: 0 }] : [];
  }
  return pickTwoShipping(usable).map((q) => ({ ...q, free: false }));
}

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ cep: cepSchema, items: z.array(itemSchema).min(1).max(40), coupon: couponSchema }),
  )
  .handler(async ({ data }) => {
    let lines: ReturnType<typeof buildLines>;
    try {
      lines = buildLines(data.items);
    } catch {
      // Rejected before contacting any payment or shipping provider.
      return { ok: false as const, message: staleCartMessage };
    }
    try {
      return {
        ok: true as const,
        options: await shippingOptions(data.cep, lines, data.coupon),
      };
    } catch {
      console.error("[frete] Cotação indisponível");
      return {
        ok: false as const,
        message: "Não foi possível calcular o frete agora. Tente novamente em instantes.",
      };
    }
  });

export const getPaymentConfig = createServerFn({ method: "GET" }).handler(async () => ({
  externalId: env("APPMAX_EXTERNAL_ID"),
  sandbox: env("APPMAX_ENV") !== "production",
  pixEnabled:
    !!env("APPMAX_CLIENT_ID") &&
    !!env("APPMAX_CLIENT_SECRET") &&
    !!env("SUPABASE_URL") &&
    !!env("SUPABASE_SERVICE_ROLE_KEY") &&
    env("CHECKOUT_IDEMPOTENCY_SECRET").length >= 32,
  cardEnabled:
    !!env("APPMAX_CLIENT_ID") &&
    !!env("APPMAX_CLIENT_SECRET") &&
    !!env("APPMAX_EXTERNAL_ID") &&
    !!env("SUPABASE_URL") &&
    !!env("SUPABASE_SERVICE_ROLE_KEY") &&
    env("CHECKOUT_IDEMPOTENCY_SECRET").length >= 32,
}));

const customerSchema = z.object({
  nome: z.string().min(3).max(120),
  email: z.string().email().max(160),
  cpf: z.string().min(11).max(14).refine(isValidCpf, "CPF inválido. Confira os números."),
  whatsapp: z.string().min(10).max(20),
});
const addressSchema = z.object({
  cep: cepSchema,
  rua: z.string().min(1).max(160),
  numero: z.string().min(1).max(20),
  complemento: z.string().max(80).optional().default(""),
  bairro: z.string().min(1).max(100),
  cidade: z.string().min(1).max(100),
  uf: z.string().length(2),
});

const paySchema = z.object({
  customer: customerSchema,
  address: addressSchema,
  items: z.array(itemSchema).min(1).max(40),
  serviceId: z.number().int(),
  coupon: couponSchema,
  ref: z.string().max(30).optional(),
  method: z.enum(["pix", "card"]),
  token: z.string().max(200).optional(),
  holderName: z.string().max(120).optional(),
  installments: z.number().int().min(1).max(6).optional(),
  marketingConsent: z.boolean().optional(),
});

export const createPayment = createServerFn({ method: "POST" })
  .inputValidator(paySchema)
  .handler(async ({ data }) => {
    // Validate card token BEFORE external configuration or side effects.
    if (data.method === "card" && !data.token) {
      return {
        ok: false as const,
        message: "Não foi possível validar o cartão. Confira os dados e tente de novo.",
      };
    }
    if (data.method === "card" && !env("APPMAX_EXTERNAL_ID")) {
      return {
        ok: false as const,
        message:
          "Pagamento por cartão temporariamente indisponível. Escolha Pix ou fale com o atendimento.",
      };
    }
    if (
      !env("APPMAX_CLIENT_ID") ||
      !env("APPMAX_CLIENT_SECRET") ||
      !env("SUPABASE_URL") ||
      !env("SUPABASE_SERVICE_ROLE_KEY") ||
      env("CHECKOUT_IDEMPOTENCY_SECRET").length < 32
    )
      return {
        ok: false as const,
        message:
          "Os pagamentos desta loja estão sendo ativados. Fale com a gente no WhatsApp para comprar agora.",
      };
    let lines: ReturnType<typeof buildLines>;
    try {
      lines = buildLines(data.items);
    } catch {
      // The input basket was invalid before any provider call or payment intent.
      return { ok: false as const, retrySafe: true as const, message: staleCartMessage };
    }
    try {
      const option = (await shippingOptions(data.address.cep, lines, data.coupon)).find(
        (o) => o.id === data.serviceId,
      );
      if (!option) return { ok: false as const, message: "Escolha uma opção de entrega válida." };

      const coupon = findCoupon(data.coupon);
      const gross = checkoutTotals(lines, "card").gross;
      if (data.coupon && !coupon)
        return {
          ok: false as const,
          message: "Cupom inválido. Remova o cupom ou confira o código.",
        };
      if (coupon) {
        const chk = couponCheck(coupon, gross);
        if (!chk.ok) return { ok: false as const, message: chk.reason };
      }
      const totals = checkoutTotals(
        lines,
        data.method === "pix" ? "pix" : "card",
        couponPercent(coupon, gross),
      );
      const document = data.customer.cpf.replace(/\D/g, "");
      const [first = "", ...rest] = data.customer.nome.trim().split(/\s+/);
      // Antifraud IP must never come from a browser field or arbitrary
      // X-Forwarded-For; only trust the IP set by our Cloudflare edge.
      const edgeIp = getRequestHeader("cf-connecting-ip")?.trim() ?? "";
      const ip = isIP(edgeIp) ? edgeIp : "0.0.0.0";

      // Reserve this server-priced shopping intent atomically BEFORE external
      // customer, order or payment calls. A second browser/device cannot charge it.
      const fingerprint = checkoutFingerprint({
        document,
        address: {
          postcode: data.address.cep,
          street: data.address.rua,
          number: data.address.numero,
          city: data.address.cidade,
          state: data.address.uf,
        },
        items: lines.map((l) => ({
          // The physical SKU/variant and UNIT count, not coupon, price or
          // payment method, define whether this is the same shopping attempt.
          sku: `${l.product.slug}:${l.variant}`,
          quantity: l.units,
        })),
      });
      const intent = await claimCheckoutIntent(fingerprint);
      if (!intent.claimed) {
        if (intent.orderId) {
          // The original browser may have lost the response after creating
          // the order. Only follow its existing status; NEVER submit again.
          return {
            ok: true as const,
            method: "verification" as const,
            orderId: intent.orderId,
            statusToken: orderStatusToken(intent.orderId),
            total: totals.net + option.price,
            paid: false,
            status: "aguardando_confirmacao",
          };
        }
        return {
          ok: false as const,
          message:
            "Já existe uma tentativa de compra em verificação. Não tente pagar novamente; entre em contato com o atendimento para confirmar o pedido.",
        };
      }
      const claimToken = intent.claimToken!;
      // Fence the intent BEFORE the first external side effect.
      // A timeout after this point is ambiguous; it must NEVER be retried blindly.
      await advanceCheckoutIntent(fingerprint, claimToken, "reserved");

      const customerId = await appmax.createCustomer({
        first_name: first,
        last_name: rest.join(" ") || first,
        email: data.customer.email,
        phone: data.customer.whatsapp.replace(/\D/g, ""),
        document_number: document,
        ip,
        address: {
          postcode: data.address.cep.replace(/\D/g, ""),
          street: data.address.rua,
          number: data.address.numero,
          complement: data.address.complemento,
          district: data.address.bairro,
          city: data.address.cidade,
          state: data.address.uf.toUpperCase(),
        },
        // Venda pelo link de uma afiliada: a origem fica registrada no pedido (utm_campaign = afiliada-<codigo>).
        ...(normalizeRef(data.ref)
          ? {
              tracking: {
                utm_source: "afiliada",
                utm_campaign: refCampaign(normalizeRef(data.ref) as string),
              },
            }
          : {}),
      });

      const products = lines.map((l) => ({
        sku: `${l.product.slug}${l.offer ? `-${l.offer}` : ""}`,
        name: `${l.units}x ${l.product.name} (${l.variant})`,
        quantity: 1,
        unit_value: cents(l.net),
        type: "physical" as const,
      }));
      const orderId = await appmax.createOrder({
        customer_id: customerId,
        // Per-item unit_value already prices products; do not also send products_value.
        discount_value: cents(totals.pixDiscount) + cents(totals.couponDiscount),
        shipping_value: cents(option.price),
        products,
      });
      await advanceCheckoutIntent(fingerprint, claimToken, "creating_order", orderId);
      // Save data available only at checkout (not returned by Appmax GET /v1/orders/{id}).
      // Fail closed BEFORE requesting a payment if durable storage is unavailable.
      await saveOrderSnapshot({
        orderId,
        customer: {
          name: data.customer.nome.trim(),
          email: data.customer.email,
          phone: data.customer.whatsapp.replace(/\D/g, ""),
          documentNumber: document,
        },
        address: {
          street: data.address.rua,
          number: data.address.numero,
          complement: data.address.complemento,
          district: data.address.bairro,
          city: data.address.cidade,
          state: data.address.uf.toUpperCase(),
          postcode: data.address.cep.replace(/\D/g, ""),
        },
        products: products.map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          unitValueCents: p.unit_value,
        })),
        shippingValueCents: cents(option.price),
        discountValueCents: cents(totals.pixDiscount) + cents(totals.couponDiscount),
        // Record the browser\'s checkout choice for the later paid-only marketing worker.
        // No choice or older clients are conservatively interpreted as rejection.
        marketingConsent: {
          accepted: data.marketingConsent === true,
          policyVersion: "v1",
          recordedAt: new Date().toISOString(),
        },
      });
      const total = totals.net + option.price;
      // Venda pelo link de uma afiliada: o app de expedição registra como pendente; só conta comissão depois de paga.
      const ref = normalizeRef(data.ref);
      if (ref)
        await notifyAffiliateSale({
          orderId,
          status: "pendente",
          ref,
          totalCents: cents(total),
        }).catch(() => undefined);

      // One fenced transition for BOTH payment methods. If the gateway response
      // disappears, this purchase remains blocked until independently verified.
      await advanceCheckoutIntent(fingerprint, claimToken, "order_created");

      if (data.method === "pix") {
        let pix: Awaited<ReturnType<typeof appmax.payWithPix>>;
        try {
          pix = await appmax.payWithPix(orderId, document);
        } catch {
          // Appmax may have created a Pix before the connection failed.
          // Never create a second Pix automatically; recover by status only.
          return {
            ok: true as const,
            method: "verification" as const,
            orderId,
            statusToken: orderStatusToken(orderId),
            total,
            paid: false,
            status: "aguardando_confirmacao",
          };
        }
        await advanceCheckoutIntent(fingerprint, claimToken, "charging");
        return {
          ok: true as const,
          method: "pix" as const,
          orderId,
          statusToken: orderStatusToken(orderId),
          total,
          pix: { emv: pix.pix_emv, qrcode: pix.pix_qrcode, expiresAt: pix.pix_expiration_date },
        };
      }

      if (!data.token)
        return {
          ok: false as const,
          message: "Não foi possível validar o cartão. Confira os dados e tente de novo.",
        };
      // A timeout after submitting a card is NOT proof that payment was declined.
      // Preserve the order reference and check asynchronously, never prompt double charge.
      try {
        await appmax.payWithCard({
          orderId,
          customerId,
          token: data.token,
          holderName: data.holderName || data.customer.nome,
          document,
          installments: data.installments ?? 1,
        });
        await advanceCheckoutIntent(fingerprint, claimToken, "charging");
      } catch {
        return {
          ok: true as const,
          method: "card" as const,
          orderId,
          statusToken: orderStatusToken(orderId),
          total,
          paid: false,
          status: "verificacao_necessaria",
        };
      }
      try {
        const order = await appmax.getOrder(orderId);
        if (appmax.isPaid(order)) {
          await finalizeCheckoutIntent(orderId, "completed").catch(() => undefined);
          if (ref) await notifyAffiliateSale({ orderId, status: "pago" }).catch(() => undefined);
        } else if (["cancelado", "recusado_por_risco"].includes(order.data.order.status)) {
          await finalizeCheckoutIntent(orderId, "cancelled").catch(() => undefined);
        }
        return {
          ok: true as const,
          method: "card" as const,
          orderId,
          statusToken: orderStatusToken(orderId),
          total,
          paid: appmax.isPaid(order),
          status: order.data.order.status,
        };
      } catch {
        return {
          ok: true as const,
          method: "card" as const,
          orderId,
          statusToken: orderStatusToken(orderId),
          total,
          paid: false,
          status: "aguardando_confirmacao",
        };
      }
    } catch (e) {
      // An external API timeout can occur AFTER an order has been created.
      // Never imply that the customer is safe to retry a charge blindly.
      console.error("[pagamento] Falha na operação de compra; reconciliação necessária");
      return {
        ok: false as const,
        message:
          "Não foi possível confirmar a tentativa de compra. Para evitar cobrança duplicada, consulte o atendimento antes de tentar pagar novamente.",
        retrySafe: false as const,
      };
    }
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ orderId: z.number().int().positive(), statusToken: z.string().min(30).max(128) }),
  )
  .handler(async ({ data }) => {
    try {
      if (!validOrderStatusToken(data.orderId, data.statusToken)) return { ok: false as const };
      const order = await appmax.getOrder(data.orderId);
      const paid = appmax.isPaid(order);
      if (paid) {
        await finalizeCheckoutIntent(data.orderId, "completed").catch(() => undefined);
        await notifyAffiliateSale({ orderId: data.orderId, status: "pago" }).catch(() => undefined);
      } else if (["cancelado", "recusado_por_risco"].includes(order.data.order.status)) {
        await finalizeCheckoutIntent(data.orderId, "cancelled").catch(() => undefined);
      }
      return { ok: true as const, paid, status: order.data.order.status };
    } catch {
      console.error("[status] Consulta temporariamente indisponível");
      return { ok: false as const };
    }
  });
