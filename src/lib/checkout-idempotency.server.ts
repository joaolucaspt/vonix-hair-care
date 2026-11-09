import { createHmac } from "node:crypto";
import { z } from "zod";
import { env } from "./env.server";

/** Server-only HMAC fingerprint: no CPF/address/basket in the intent table.
 * Same buyer + physical items + destination share one attempt ACROSS Pix/card,
 * coupons, changing prices or shipping methods. Never charge the same intent twice.
 */
export function checkoutFingerprint(input: {
  document: string;
  address: { postcode: string; street: string; number: string; city: string; state: string };
  items: { sku: string; quantity: number }[];
}): string {
  const secret = env("CHECKOUT_IDEMPOTENCY_SECRET");
  if (secret.length < 32) throw new Error("Proteção contra pagamentos duplicados indisponível");
  const physicalItems = new Map<string, number>();
  for (const { sku, quantity } of input.items) {
    if (!sku || !Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error("Itens de compra inválidos");
    physicalItems.set(sku, (physicalItems.get(sku) ?? 0) + quantity);
  }
  if (physicalItems.size === 0) throw new Error("Carrinho vazio");
  const payload = {
    document: input.document.replace(/\D/g, ""),
    destination: {
      postcode: input.address.postcode.replace(/\D/g, ""),
      street: input.address.street.trim().toLowerCase(),
      number: input.address.number.trim().toLowerCase(),
      city: input.address.city.trim().toLowerCase(),
      state: input.address.state.trim().toUpperCase(),
    },
    items: [...physicalItems.entries()]
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
  };
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

const intentSchema = z
  .object({
    claimed: z.boolean(),
    phase: z.enum([
      "reserved",
      "creating_order",
      "order_created",
      "charging",
      "submitted",
      "completed",
      "cancelled",
    ]),
    orderId: z.number().int().positive().safe().nullable(),
    claimToken: z.string().uuid().nullable(),
  })
  .strict();
export type CheckoutIntent = z.infer<typeof intentSchema>;

const storedIntentSchema = z
  .array(
    z
      .object({
        phase: intentSchema.shape.phase,
        order_id: z.number().int().positive().safe().nullable(),
        updated_at: z.string().min(1).max(80),
      })
      .strict(),
  )
  .max(1);

/** Read-only recovery: it must NEVER reserve a new purchase or unlock a charge.
 * This table is already SELECT-granted to the service role by the checkout SQL.
 * No CPF, card data or customer address crosses the DB boundary.
 */
export async function lookupExistingCheckoutIntent(fingerprint: string): Promise<{
  phase: CheckoutIntent["phase"];
  orderId: number | null;
  updatedAt: string;
} | null> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Impressão da compra inválida");
  const { url, key } = connection();
  const response = await fetch(
    `${url}/rest/v1/vonix_checkout_intents?fingerprint=eq.${fingerprint}&select=phase,order_id,updated_at&limit=1`,
    {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "cache-control": "no-store" },
      signal: AbortSignal.timeout(4500),
    },
  );
  if (!response.ok) throw new Error(`Intent read HTTP ${response.status}`);
  const record = storedIntentSchema.parse(await response.json())[0];
  return record
    ? { phase: record.phase, orderId: record.order_id, updatedAt: record.updated_at }
    : null;
}

function connection() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Armazenamento das tentativas de compra indisponível");
  return { url: url.replace(/\/$/, ""), key };
}

async function rpc<T>(name: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const { url, key } = connection();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`Intent storage HTTP ${response.status}`);
  return schema.parse(await response.json());
}

/** Exactly one caller can claim an identical shopping intent. No gateway activity on duplicates. */
export async function claimCheckoutIntent(fingerprint: string): Promise<CheckoutIntent> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("Impressão da compra inválida");
  const intent = await rpc("vonix_checkout_claim", { p_fingerprint: fingerprint }, intentSchema);
  if (
    intent.claimed &&
    (!intent.claimToken || intent.phase !== "reserved" || intent.orderId !== null)
  )
    throw new Error("Reserva de pagamento inválida");
  if (!intent.claimed && intent.claimToken !== null)
    throw new Error("Reserva de pagamento inválida");
  return intent;
}

export type IntentPhase = CheckoutIntent["phase"];
const next: Record<string, string> = {
  reserved: "creating_order",
  creating_order: "order_created",
  order_created: "charging",
  charging: "submitted",
};

/** Fenced transition: only the claim holder with an exact phase/token can advance. */
export async function advanceCheckoutIntent(
  fingerprint: string,
  claimToken: string,
  phase: "reserved" | "creating_order" | "order_created" | "charging",
  orderId?: number,
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || !z.string().uuid().safeParse(claimToken).success)
    throw new Error("Reserva inválida");
  if (phase === "creating_order" && (!orderId || !Number.isSafeInteger(orderId)))
    throw new Error("Identificador de pedido necessário");
  const changed = await rpc(
    "vonix_checkout_advance",
    {
      p_fingerprint: fingerprint,
      p_token: claimToken,
      p_expected: phase,
      p_next: next[phase],
      p_order_id: orderId ?? null,
    },
    z.boolean(),
  );
  if (!changed) throw new Error("Reserva de pedido perdida");
}

/** Invoked only AFTER an authenticated Appmax status confirms payment/cancellation. */
export async function finalizeCheckoutIntent(
  orderId: number,
  outcome: "completed" | "cancelled",
): Promise<void> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new Error("Pedido inválido");
  const changed = await rpc(
    "vonix_checkout_finalize",
    {
      p_order_id: orderId,
      p_outcome: outcome,
    },
    z.boolean(),
  );
  if (!changed) throw new Error("Tentativa de compra não encontrada");
}
