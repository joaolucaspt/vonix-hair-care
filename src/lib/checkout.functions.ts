import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import * as appmax from "./appmax.server";
import { isValidCpf } from "./cpf";
import { env } from "./env.server";
import { calculateShipping } from "./melhorenvio.server";
import { checkoutTotals, getProduct, lineTotals, type Offer } from "./store";
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
  return items.map((i) => {
    const p = getProduct(i.slug);
    const v = p?.variants.find((x) => x.label === i.variant);
    if (!p || !v) throw new Error(`Produto indisponível: ${i.slug}`);
    const t = lineTotals(v.price, i.qty, i.offer as Offer | undefined);
    return { product: p, variant: v.label, offer: i.offer as Offer | undefined, ...t };
  });
}

const cents = (v: number) => Math.round(v * 100);

const couponSchema = z.string().max(30).optional();

async function shippingOptions(cep: string, lines: ReturnType<typeof buildLines>, couponCode?: string) {
  const quotes = await calculateShipping(
    cep,
    lines.map((l) => ({ id: l.product.slug, unitPrice: l.net / l.units, quantity: l.units })),
  );
  const t = checkoutTotals(lines, "pix");
  const free = t.freeShipping || couponFreeShipping(findCoupon(couponCode), t.gross);
  return quotes.map((q, k) => ({ ...q, free: free && k === 0, price: free && k === 0 ? 0 : q.price }));
}

export const quoteShipping = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cep: cepSchema, items: z.array(itemSchema).min(1).max(40), coupon: couponSchema }))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, options: await shippingOptions(data.cep, buildLines(data.items), data.coupon) };
    } catch (e) {
      console.error("[frete]", e);
      return { ok: false as const, message: "Não foi possível calcular o frete agora. Tente novamente em instantes." };
    }
  });

export const getPaymentConfig = createServerFn({ method: "GET" }).handler(async () => ({
  externalId: env("APPMAX_EXTERNAL_ID"),
  sandbox: env("APPMAX_ENV") !== "production",
  pixEnabled: !!env("APPMAX_CLIENT_ID") && !!env("APPMAX_CLIENT_SECRET"),
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
  ip: z.string().max(64).optional(),
  method: z.enum(["pix", "card"]),
  token: z.string().max(200).optional(),
  holderName: z.string().max(120).optional(),
  installments: z.number().int().min(1).max(6).optional(),
});

export const createPayment = createServerFn({ method: "POST" })
  .inputValidator(paySchema)
  .handler(async ({ data }) => {
    try {
      const lines = buildLines(data.items);
      const option = (await shippingOptions(data.address.cep, lines, data.coupon)).find((o) => o.id === data.serviceId);
      if (!option) return { ok: false as const, message: "Escolha uma opção de entrega válida." };

      const coupon = findCoupon(data.coupon);
      const gross = checkoutTotals(lines, "card").gross;
      if (data.coupon && !coupon) return { ok: false as const, message: "Cupom inválido. Remova o cupom ou confira o código." };
      if (coupon) {
        const chk = couponCheck(coupon, gross);
        if (!chk.ok) return { ok: false as const, message: chk.reason };
      }
      const totals = checkoutTotals(lines, data.method === "pix" ? "pix" : "card", couponPercent(coupon, gross));
      const document = data.customer.cpf.replace(/\D/g, "");
      const [first = "", ...rest] = data.customer.nome.trim().split(/\s+/);
      const ip = data.ip || getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

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
        products_value: products.reduce((s, p) => s + p.unit_value, 0),
        discount_value: cents(totals.pixDiscount) + cents(totals.couponDiscount),
        shipping_value: cents(option.price),
        products,
      });
      const total = totals.net + option.price;

      if (data.method === "pix") {
        const pix = await appmax.payWithPix(orderId, document);
        return { ok: true as const, method: "pix" as const, orderId, total, pix: { emv: pix.pix_emv, qrcode: pix.pix_qrcode, expiresAt: pix.pix_expiration_date } };
      }

      if (!data.token) return { ok: false as const, message: "Não foi possível validar o cartão. Confira os dados e tente de novo." };
      await appmax.payWithCard({
        orderId,
        customerId,
        token: data.token,
        holderName: data.holderName || data.customer.nome,
        document,
        installments: data.installments ?? 1,
      });
      const order = await appmax.getOrder(orderId);
      return { ok: true as const, method: "card" as const, orderId, total, paid: appmax.isPaid(order), status: order.data.order.status };
    } catch (e) {
      console.error("[pagamento]", e);
      return { ok: false as const, message: "Não conseguimos processar o pagamento. Confira os dados ou tente outra forma de pagamento." };
    }
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    try {
      const order = await appmax.getOrder(data.orderId);
      return { ok: true as const, paid: appmax.isPaid(order), status: order.data.order.status };
    } catch (e) {
      console.error("[status]", e);
      return { ok: false as const };
    }
  });
