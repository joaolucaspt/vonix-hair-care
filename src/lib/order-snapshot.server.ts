import { z } from "zod";
import { env } from "./env.server";

const cents = z.number().int().nonnegative().safe();
export const orderSnapshotSchema = z
  .object({
    orderId: z.number().int().positive().safe(),
    customer: z.object({
      name: z.string().min(1).max(120),
      email: z.string().email(),
      phone: z.string().min(8).max(20),
      documentNumber: z.string().regex(/^\d{11,14}$/),
    }),
    address: z.object({
      street: z.string().min(1).max(160),
      number: z.string().min(1).max(20),
      complement: z.string().max(80),
      district: z.string().min(1).max(100),
      city: z.string().min(1).max(100),
      state: z.string().length(2),
      postcode: z.string().regex(/^\d{8}$/),
    }),
    products: z
      .array(
        z.object({
          sku: z.string().min(1).max(120),
          name: z.string().min(1).max(220),
          quantity: z.number().int().min(1).max(99),
          unitValueCents: cents,
        }),
      )
      .min(1)
      .max(40),
    shippingValueCents: cents,
    discountValueCents: cents,
    // Optional for legacy snapshots; absence means marketing consent is unproven.
    marketingConsent: z.object({
      accepted: z.boolean(),
      policyVersion: z.literal("v1"),
      recordedAt: z.string().datetime(),
    }).optional(),
  })
  .strict();

export type OrderSnapshot = z.infer<typeof orderSnapshotSchema>;

/** Exact original checkout amount (cents), never a fresh re-quote.
 * The snapshot is authoritative only after it passes the server-side schema.
 */
export function snapshotTotalCents(input: OrderSnapshot): number {
  const snapshot = orderSnapshotSchema.parse(input);
  const subtotal = snapshot.products.reduce(
    (sum, p) => sum + p.unitValueCents * p.quantity, 0,
  );
  const total = subtotal + snapshot.shippingValueCents - snapshot.discountValueCents;
  if (!Number.isSafeInteger(total) || total <= 0)
    throw new Error("Valor original do pedido inválido");
  return total;
}

function connection() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Armazenamento de pedidos não configurado");
  return { url: url.replace(/\/$/, ""), key };
}
function headers(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    "cache-control": "no-store",
  };
}

/** Persist the server-priced order BEFORE requesting payment. Fail closed on storage failure. */
export async function saveOrderSnapshot(input: OrderSnapshot): Promise<void> {
  const snapshot = orderSnapshotSchema.parse(input);
  const { url, key } = connection();
  const result = await fetch(`${url}/rest/v1/vonix_order_snapshots`, {
    method: "POST",
    headers: { ...headers(key), Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ order_id: snapshot.orderId, payload: snapshot }),
    signal: AbortSignal.timeout(4500),
  });
  if (!result.ok) throw new Error(`Snapshot write HTTP ${result.status}`);
}

export async function loadOrderSnapshot(orderId: number): Promise<OrderSnapshot> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new Error("Pedido inválido");
  const { url, key } = connection();
  const response = await fetch(
    `${url}/rest/v1/vonix_order_snapshots?order_id=eq.${orderId}&select=payload&limit=1`,
    { headers: headers(key), signal: AbortSignal.timeout(4500) },
  );
  if (!response.ok) throw new Error(`Snapshot read HTTP ${response.status}`);
  const data = (await response.json()) as { payload?: unknown }[];
  if (!Array.isArray(data) || data.length !== 1) throw new Error("Pedido sem snapshot homologado");
  const parsed = orderSnapshotSchema.parse(data[0]?.payload);
  if (parsed.orderId !== orderId) throw new Error("Snapshot de outro pedido");
  return parsed;
}
