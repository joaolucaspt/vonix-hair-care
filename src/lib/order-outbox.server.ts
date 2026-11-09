import { env } from "./env.server";
import { assertAppmaxOrder, getOrder, isPaid, isReadyForFulfillment } from "./appmax.server";
import { blingEnabled, sendPaidOrder } from "./bling.server";
import { loadOrderSnapshot } from "./order-snapshot.server";
import { isTerminatedOrder } from "./order-events";
import { finalizeCheckoutIntent } from "./checkout-idempotency.server";
import { sendVerifiedPurchase } from "./meta-capi.server";

/**
 * Durable, fail-closed outbox backed by Supabase/PostgREST.
 * Requires the SQL migration in supabase/vonix-order-outbox.sql and a scheduled
 * POST to /api/internal/order-worker with ORDER_WORKER_SECRET.
 *
 * No orders are dispatched from the public webhook request.
 */
function connection() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Outbox não configurada");
  return { url: url.replace(/\/$/, ""), key };
}

async function db<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  preference = "return=representation",
): Promise<T> {
  const { url, key } = connection();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      Prefer: preference,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`Outbox HTTP ${response.status}`);
  if (preference.includes("return=minimal")) return undefined as T;
  return (await response.json()) as T;
}

export async function enqueueOrder(orderId: number, event: string | null = null): Promise<void> {
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new Error("ID de pedido inválido");
  // Used only to signal manual review of already-exported refunded/charged-back orders.
  // The database validates that the order was created by this checkout.
  await db<void>(
    "rpc/vonix_enqueue_order",
    "POST",
    { p_order_id: orderId, p_event: event },
    "return=minimal",
  );
}

/** Repair lost Appmax callbacks: enqueue only snapshots with no outbox record.
 * The SQL RPC applies a bounded, age-gated insert; no browser access or secrets.
 * A recovered ID still needs authoritative Appmax payment status confirmation.
 */
export async function reconcileOrderOutbox(limit = 10): Promise<number> {
  const count = await db<number>("rpc/vonix_reconcile_order_outbox", "POST", {
    max_count: Math.max(1, Math.min(Math.floor(limit), 20)),
  });
  if (!Number.isSafeInteger(count) || count < 0 || count > 20)
    throw new Error("Contagem de conciliação inválida");
  return count;
}

async function claim(limit: number) {
  return db<{ order_id: number; claim_token: string }[]>("rpc/vonix_claim_order_outbox", "POST", {
    max_count: Math.max(1, Math.min(limit, 5)),
  });
}

async function finish(
  orderId: number,
  claimToken: string,
  status: "completed" | "pending",
  delayMinutes = 0,
) {
  if (!/^[0-9a-f-]{36}$/i.test(claimToken)) throw new Error("Lease token inválido");
  const rows = await db<{ order_id: number }[]>(
    `vonix_order_outbox?order_id=eq.${orderId}&status=eq.leased&claim_token=eq.${claimToken}`,
    "PATCH",
    {
      status,
      claimed_until: null,
      claim_token: null,
      updated_at: new Date().toISOString(),
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      ...(status === "completed" ? { processed_at: new Date().toISOString() } : {}),
    },
  );
  if (rows.length !== 1) throw new Error("Lease da outbox expirado ou ausente");
}

export type WorkerSummary = {
  claimed: number;
  exported: number;
  alreadyExported: number;
  deferred: number;
  failed: number;
};

/** Processing is intentionally serialized and capped for external API rate limits. */
export async function processOrderOutbox(limit = 3): Promise<WorkerSummary> {
  const rows = await claim(limit);
  const stats: WorkerSummary = {
    claimed: rows.length,
    exported: 0,
    alreadyExported: 0,
    deferred: 0,
    failed: 0,
  };
  for (const { order_id: id, claim_token: token } of rows) {
    try {
      const order = await getOrder(id); // never trust unsigned webhook status
      // Defense in depth: an inconsistent gateway response cannot authorize
      // fulfillment or payment finalization for another local order.
      assertAppmaxOrder(order, id);
      // Reconcile the duplicate-payment guard even if the buyer never returns
      // to the checkout. ERP failures should not hide an Appmax-confirmed status.
      if (isPaid(order)) {
        await finalizeCheckoutIntent(id, "completed").catch(() => undefined);
        // Meta CAPI Purchase requires an authenticated Appmax-approved order.
        await sendVerifiedPurchase(order).catch(() => undefined);
      } else if (["cancelado", "recusado_por_risco"].includes(order.data.order.status))
        await finalizeCheckoutIntent(id, "cancelled").catch(() => undefined);
      if (isTerminatedOrder(order.data.order.status)) {
        await finish(id, token, "completed");
        stats.deferred++;
      } else if (!isReadyForFulfillment(order)) {
        await finish(id, token, "pending", 30);
        stats.deferred++;
      } else {
        if (!blingEnabled()) throw new Error("Bling ainda não configurado");
        const snapshot = await loadOrderSnapshot(id);
        const result = await sendPaidOrder(snapshot);
        await finish(id, token, "completed");
        if (result === "ja enviado") stats.alreadyExported++;
        else stats.exported++;
      }
    } catch {
      // Back off, do not acknowledge a failed ERP export as completed.
      try {
        await finish(id, token, "pending", 15);
      } catch {
        // The lease expires naturally; another worker will reclaim it.
      }
      stats.failed++;
    }
  }
  return stats;
}
