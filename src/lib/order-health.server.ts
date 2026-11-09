import { z } from "zod";
import { env } from "./env.server";

/** Aggregate-only monitoring. No order identifiers, customer data or tokens. */
export const orderHealthSchema = z
  .object({
    pending: z.number().int().nonnegative().safe(),
    leased: z.number().int().nonnegative().safe(),
    completed: z.number().int().nonnegative().safe(),
    awaitingReview: z.number().int().nonnegative().safe(),
    readyToRetry: z.number().int().nonnegative().safe(),
    expiredLeases: z.number().int().nonnegative().safe(),
    multipleAttempts: z.number().int().nonnegative().safe(),
    completedLast24h: z.number().int().nonnegative().safe(),
    oldestPendingMinutes: z.number().int().nonnegative().safe(),
  })
  .strict();

export type OrderHealth = z.infer<typeof orderHealthSchema>;

export async function getOrderHealth(): Promise<OrderHealth> {
  const url = env("SUPABASE_URL");
  const secret = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) throw new Error("Diagnóstico de pedidos não configurado");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/vonix_order_health_summary`, {
    method: "POST",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: "{}",
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`Order-health HTTP ${response.status}`);
  return orderHealthSchema.parse(await response.json());
}
