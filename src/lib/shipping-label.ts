/**
 * Regras puras da etiqueta automática (sem rede): leitura do pedido pago, escolha do serviço de frete,
 * corpo do envio no Melhor Envio e a "tag" que impede criar a mesma etiqueta duas vezes.
 */
import type { ShippingQuote } from "./melhorenvio.server";
import { pickFreeShipping } from "./shipping-pick";

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const text = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type PaidOrder = {
  id: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
    postcode: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  freightType: string;
  freightValue: number;
  items: { name: string; quantity: number; unitValue: number }[];
  /** Unidades físicas no pacote ("2x Perfume" conta 2). */
  units: number;
  productsTotal: number;
  sellerCnpj: string;
};

/** Lê o corpo `data` do aviso "Pedido pago" do Appmax. Devolve null se faltar algo que a etiqueta exige. */
export function parsePaidOrder(data: Record<string, unknown>): PaidOrder | null {
  const id = Number(data["id"]);
  const c = (data["customer"] ?? {}) as Record<string, unknown>;
  const customer = {
    name: text(c["fullname"]) || `${text(c["firstname"])} ${text(c["lastname"])}`.trim(),
    email: text(c["email"]),
    phone: digits(c["telephone"]),
    document: digits(c["document_number"]),
    postcode: digits(c["postcode"]),
    street: text(c["address_street"]),
    number: text(c["address_street_number"]),
    complement: text(c["address_street_complement"]),
    district: text(c["address_street_district"]),
    city: text(c["address_city"]),
    state: text(c["address_state"] || c["uf"]).toUpperCase(),
  };
  if (!Number.isInteger(id) || id <= 0) return null;
  if (
    !customer.name ||
    customer.postcode.length !== 8 ||
    !customer.street ||
    !customer.number ||
    !customer.city ||
    customer.state.length !== 2
  )
    return null;
  if (customer.document.length !== 11 && customer.document.length !== 14) return null;

  const items: PaidOrder["items"] = [];
  let units = 0;
  for (const b of Array.isArray(data["bundles"])
    ? (data["bundles"] as Record<string, unknown>[])
    : []) {
    for (const p of Array.isArray(b["products"])
      ? (b["products"] as Record<string, unknown>[])
      : []) {
      const name = text(p["name"]);
      const quantity = Math.max(1, Math.round(num(p["quantity"])) || 1);
      items.push({ name, quantity, unitValue: num(p["price"]) });
      units += (Number(/^(\d+)\s*x\s/i.exec(name)?.[1]) || 1) * quantity;
    }
  }
  if (!items.length) return null;

  return {
    id,
    customer,
    freightType: text(data["freight_type"]),
    freightValue: num(data["freight_value"]),
    items,
    units: Math.max(1, units),
    productsTotal: items.reduce((s, i) => s + i.unitValue * i.quantity, 0),
    sellerCnpj: digits(data["company_cnpj"]),
  };
}

/**
 * Escolhe o serviço que o cliente pagou. O preço do frete é a prova mais confiável (o campo `freight_type`
 * do Appmax nem sempre reflete a escolha do cliente), então: preço igual primeiro, nome do serviço para desempatar.
 * Frete grátis (valor 0) usa a mesma regra do checkout.
 */
export function pickService(
  quotes: ShippingQuote[],
  freightType: string,
  freightValue: number,
): ShippingQuote | undefined {
  if (!quotes.length) return undefined;
  if (freightValue <= 0)
    return pickFreeShipping(quotes) ?? [...quotes].sort((a, b) => a.price - b["price"])[0];
  const wanted = normalize(freightType);
  const diff = (q: ShippingQuote) => Math.abs(q.price - freightValue);
  const byName = (q: ShippingQuote) => (normalize(q.name) === wanted ? 0 : 1);
  return [...quotes].sort(
    (a, b) =>
      Math.round(diff(a) * 100) - Math.round(diff(b) * 100) ||
      byName(a) - byName(b) ||
      a.price - b["price"],
  )[0];
}

export type Sender = {
  name: string;
  email: string;
  phone: string;
  cnpj: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  postcode: string;
};

export type Volume = { height: number; width: number; length: number; weight: number };

/** Um pacote só (Correios e J&T não aceitam vários na mesma etiqueta): a caixa padrão cresce em altura e peso por unidade. */
export const volumeFor = (units: number, unit: Volume): Volume => ({
  width: unit.width,
  length: unit.length,
  height: unit.height * units,
  weight: Number((unit.weight * units).toFixed(3)),
});

/** A tag grava o número do pedido do Appmax no envio: é com ela que o sistema reconhece uma etiqueta já criada. */
export const orderTag = (orderId: number) => `appmax-${orderId}`;

/** Aceita tags como texto ou como { tag }. */
export const hasOrderTag = (shipment: { tags?: unknown }, orderId: number) =>
  Array.isArray(shipment.tags) &&
  shipment.tags.some(
    (t) => (typeof t === "string" ? t : (t as { tag?: unknown } | null)?.tag) === orderTag(orderId),
  );

export function buildCartBody(
  order: PaidOrder,
  serviceId: number,
  sender: Sender,
  unitVolume: Volume,
  nonCommercial: boolean,
) {
  const c = order.customer;
  return {
    service: serviceId,
    from: {
      name: sender.name,
      email: sender.email,
      phone: sender.phone,
      document: "",
      company_document: sender.cnpj,
      state_register: "",
      address: sender.address,
      complement: sender.complement,
      number: sender.number,
      district: sender.district,
      city: sender.city,
      country_id: "BR",
      postal_code: sender.postcode,
      state_abbr: sender.state,
    },
    to: {
      name: c["name"],
      email: c["email"],
      phone: c["phone"],
      document: c["document"].length === 11 ? c["document"] : "",
      company_document: c["document"].length === 14 ? c["document"] : "",
      state_register: "",
      address: c["street"],
      complement: c["complement"],
      number: c["number"],
      district: c["district"],
      city: c["city"],
      country_id: "BR",
      postal_code: c["postcode"],
      state_abbr: c["state"],
    },
    products: order.items.map((i) => ({
      name: i.name,
      quantity: String(i.quantity),
      unitary_value: String(i.unitValue.toFixed(2)),
    })),
    volumes: [volumeFor(order.units, unitVolume)],
    options: {
      insurance_value: Number(order.productsTotal.toFixed(2)),
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: nonCommercial,
      platform: "Site Vonix Hair",
      reminder: `Pedido #${order.id}`,
      tags: [{ tag: orderTag(order.id), url: null }],
    },
  };
}
