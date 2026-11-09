import { isAllowedCarrier } from "./carriers";
import { env, requireEnv } from "./env.server";

export type ShippingProduct = { id: string; unitPrice: number; quantity: number };
export type ShippingQuote = {
  id: number;
  name: string;
  company: string;
  price: number;
  days: number;
};

const base = () =>
  env("MELHORENVIO_ENV") === "production"
    ? "https://melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";

function requiredFinite(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" && typeof value !== "string") return NaN;
  if (typeof value === "string" && !value.trim()) return NaN;
  const result = Number(value);
  return Number.isFinite(result) && result >= min && result <= max ? result : NaN;
}

/** Legacy dimensions remain catalog assumptions, NOT verified SKU weights.
 * A malformed configured package must never reach the carrier calculator.
 */
function pkg() {
  const width = requiredFinite(env("MELHORENVIO_PKG_WIDTH_CM", "16"), 1, 200);
  const height = requiredFinite(env("MELHORENVIO_PKG_HEIGHT_CM", "12"), 1, 200);
  const length = requiredFinite(env("MELHORENVIO_PKG_LENGTH_CM", "22"), 1, 200);
  const weight = requiredFinite(env("MELHORENVIO_UNIT_WEIGHT_KG", "0.6"), 0.01, 100);
  if (![width, height, length, weight].every(Number.isFinite))
    throw new Error("Medidas de embalagem inválidas; cotação indisponível");
  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
    length: Math.ceil(length),
    weight,
  };
}

function validCep(cep: string): string {
  if (!/^\d{5}-?\d{3}$/.test(cep)) throw new Error("CEP inválido para cotação");
  return cep.replace("-", "");
}

type CarrierResponse = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  custom_price?: unknown;
  delivery_time?: unknown;
  custom_delivery_time?: unknown;
  error?: unknown;
  company?: { name?: unknown } | null;
};

/** External pricing and deadlines are untrusted data even after an HTTP 200.
 * Reject invalid/negative prices, non-realistic dates and duplicated service IDs.
 */
export function normalizeShippingQuotes(input: unknown): ShippingQuote[] {
  if (!Array.isArray(input)) throw new Error("Resposta de frete inválida");
  const byId = new Map<number, ShippingQuote>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const q = entry as CarrierResponse;
    if (q.error) continue;
    const id = requiredFinite(q.id, 1, Number.MAX_SAFE_INTEGER);
    const price = requiredFinite(q.custom_price ?? q.price, 0, 100_000);
    const days = requiredFinite(q.custom_delivery_time ?? q.delivery_time, 0, 365);
    const name = typeof q.name === "string" ? q.name.trim() : "";
    const company = typeof q.company?.name === "string" ? q.company.name.trim() : "";
    if (
      !Number.isSafeInteger(id) ||
      !Number.isInteger(days) ||
      !Number.isFinite(price) ||
      !name ||
      name.length > 120 ||
      !isAllowedCarrier(company)
    )
      continue;
    const quote: ShippingQuote = {
      id,
      name,
      company,
      price: Math.round(price * 100) / 100,
      days,
    };
    const previous = byId.get(id);
    if (
      !previous ||
      quote.price < previous.price ||
      (quote.price === previous.price && quote.days < previous.days)
    )
      byId.set(id, quote);
  }
  return [...byId.values()].sort((a, b) => a.price - b.price || a.days - b.days);
}

export async function calculateShipping(
  toCep: string,
  products: ShippingProduct[],
): Promise<ShippingQuote[]> {
  const to = validCep(toCep);
  const from = validCep(requireEnv("STORE_ORIGIN_CEP"));
  const p = pkg();
  if (
    !Array.isArray(products) ||
    products.length === 0 ||
    products.length > 40 ||
    products.some(
      (x) =>
        !x ||
        typeof x.id !== "string" ||
        !x.id ||
        x.id.length > 120 ||
        !Number.isSafeInteger(x.quantity) ||
        x.quantity < 1 ||
        x.quantity > 10_000 ||
        !Number.isFinite(x.unitPrice) ||
        x.unitPrice < 0 ||
        x.unitPrice > 1_000_000,
    )
  )
    throw new Error("Itens inválidos para cotação de frete");

  const token = requireEnv("MELHORENVIO_TOKEN");
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
      to: { postal_code: to },
      products: products.map((x) => ({
        id: x.id,
        width: p.width,
        height: p.height,
        length: p.length,
        weight: p.weight,
        insurance_value: Math.round(x.unitPrice * 100) / 100,
        quantity: x.quantity,
      })),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  // Provider responses are not logged: they may contain operational identifiers.
  if (!res.ok) throw new Error(`Melhor Envio HTTP ${res.status}`);
  return normalizeShippingQuotes(await res.json());
}
