import { isAllowedCarrier } from "./carriers";
import { env, requireEnv } from "./env.server";

export type ShippingProduct = { id: string; unitPrice: number; quantity: number };
export type ShippingQuote = { id: number; name: string; company: string; price: number; days: number };

const base = () =>
  env("MELHORENVIO_ENV") === "production" ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";

/** Package size per unit is a catalog assumption: override via MELHORENVIO_* env vars with real measures. */
const pkg = () => ({
  width: Math.ceil(Number(env("MELHORENVIO_PKG_WIDTH_CM", "16"))),
  height: Math.ceil(Number(env("MELHORENVIO_PKG_HEIGHT_CM", "12"))),
  length: Math.ceil(Number(env("MELHORENVIO_PKG_LENGTH_CM", "22"))),
  weight: Number(env("MELHORENVIO_UNIT_WEIGHT_KG", "0.6")),
});

export const packageSize = pkg;

/** Chamada autenticada à API do Melhor Envio (carrinho, compra, geração e busca de etiquetas). */
export async function melhorEnvio<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireEnv("MELHORENVIO_TOKEN")}`,
      "User-Agent": `Vonix Hair (${env("MELHORENVIO_CONTACT_EMAIL", "contato@vonixhaircosmeticos.com.br")})`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Melhor Envio ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function calculateShipping(toCep: string, products: ShippingProduct[]): Promise<ShippingQuote[]> {
  const token = requireEnv("MELHORENVIO_TOKEN");
  const from = requireEnv("STORE_ORIGIN_CEP").replace(/\D/g, "");
  const p = pkg();
  const res = await fetch(`${base()}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": `Vonix Hair (${env("MELHORENVIO_CONTACT_EMAIL", "contato@vonixhaircosmeticos.com.br")})`,
    },
    body: JSON.stringify({
      from: { postal_code: from },
      to: { postal_code: toCep.replace(/\D/g, "") },
      products: products.map((x) => ({
        id: x.id,
        width: p.width,
        height: p.height,
        length: p.length,
        weight: p.weight,
        insurance_value: Number(x.unitPrice.toFixed(2)),
        quantity: x.quantity,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Melhor Envio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    id: number;
    name: string;
    price: string | number;
    custom_price?: string | number;
    delivery_time?: number;
    custom_delivery_time?: number;
    error?: string;
    company?: { name?: string };
  }[];
  return data
    .filter((q) => !q.error && (q.custom_price ?? q.price) != null && isAllowedCarrier(q.company?.name ?? ""))
    .map((q) => ({
      id: q.id,
      name: q.name,
      company: q.company?.name ?? "",
      price: Number(q.custom_price ?? q.price),
      days: Number(q.custom_delivery_time ?? q.delivery_time ?? 0),
    }))
    .sort((a, b) => a.price - b.price);
}
