import { z } from "zod";
import { env } from "./env.server";

/** Private, durable claim for paid-order CAPI events.
 * The claim prevents repeat sends during periodic Appmax status checks.
 */
const claimSchema = z
  .object({
    claimed: z.boolean(),
    claimToken: z.string().uuid().nullable(),
  })
  .strict();

async function rpc<T>(name: string, input: unknown, schema: z.ZodType<T>): Promise<T> {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Armazenamento da entrega Meta indisponível");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`Meta delivery store HTTP ${response.status}`);
  return schema.parse(await response.json());
}

export async function claimMetaPurchase(orderId: number): Promise<string | null> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0)
    throw new Error("Identificador de pedido inválido");
  const claim = await rpc(
    "vonix_claim_meta_purchase",
    {
      p_order_id: orderId,
    },
    claimSchema,
  );
  if (!claim.claimed) {
    if (claim.claimToken !== null) throw new Error("Reserva Meta inválida");
    return null;
  }
  if (!claim.claimToken) throw new Error("Reserva Meta sem token");
  return claim.claimToken;
}

/** Acknowledge only when the same worker still owns the database lease. */
export async function acknowledgeMetaPurchase(orderId: number, token: string): Promise<void> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !z.string().uuid().safeParse(token).success)
    throw new Error("Confirmação Meta inválida");
  const acknowledged = await rpc(
    "vonix_ack_meta_purchase",
    {
      p_order_id: orderId,
      p_claim_token: token,
    },
    z.boolean(),
  );
  if (!acknowledged) throw new Error("Confirmação Meta não persistida");
}

/** Small, due-only batches drawn from local order records, including completed ERP orders.
 * A candidate is not proof of payment; callers MUST recheck Appmax first.
 */
export async function dueMetaRecoveryOrders(limit = 3): Promise<number[]> {
  const count = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 5)) : 3;
  const candidates = await rpc(
    "vonix_meta_recovery_candidates",
    { max_count: count },
    z.array(z.object({ order_id: z.number().int().positive().safe() }).strict()).max(5),
  );
  const ids = candidates.map((candidate) => candidate.order_id);
  if (new Set(ids).size !== ids.length) throw new Error("Candidatos Meta duplicados");
  return ids;
}

/** Rate-limits verification of unpaid and failed events. Does not change payment state. */
export async function deferMetaRecovery(orderId: number, delayMinutes: number): Promise<void> {
  if (
    !Number.isSafeInteger(orderId) ||
    orderId <= 0 ||
    !Number.isSafeInteger(delayMinutes) ||
    delayMinutes < 5 ||
    delayMinutes > 1440
  )
    throw new Error("Adiamento de recuperação inválido");
  const changed = await rpc(
    "vonix_defer_meta_recovery",
    {
      p_order_id: orderId,
      p_delay_minutes: delayMinutes,
    },
    z.boolean(),
  );
  if (!changed) {
    // Can occur if another worker delivered the event in the meantime.
    return;
  }
}
