/** Untrusted webhook data. Always check the order's actual status via the Appmax API. */
const EVENTS = new Set([
  "order_paid",
  "order_approved",
  "order_integrated",
  "order_pending_integration",
  "order_refused_by_risk",
  "order_paid_by_pix",
  "order_refund",
  "order_partial_refund",
  "order_chargeback_in_treatment",
  "order_cancelled",
  "order_canceled",
]);

export type OrderEvent = { event: string; orderId: number };

export function parseOrderEvent(body: unknown): OrderEvent | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (typeof data["event"] !== "string" || !EVENTS.has(data["event"])) return null;
  const raw = data["data"];
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const nested =
    payload["order"] && typeof payload["order"] === "object"
      ? (payload["order"] as Record<string, unknown>)["id"]
      : undefined;
  const value = nested ?? payload["order_id"] ?? payload["id"];
  // Only positive safe integer identifiers; no coercion from arbitrary strings/floats.
  const id = typeof value === "string" && /^\d{1,15}$/.test(value) ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  return { event: data["event"], orderId: id };
}

export const isTerminatedOrder = (status: string) =>
  /^(cancelado|estornado|recusado_por_risco|chargeback_perdido|chargeback_em_disputa|chargeback_em_tratativa)$/.test(
    status.trim().toLowerCase(),
  );
