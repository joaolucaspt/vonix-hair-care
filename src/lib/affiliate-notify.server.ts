import { env } from "./env.server";

export type AffiliateSaleStatus = "pendente" | "pago" | "cancelado";

/**
 * Avisa o app de expedição sobre uma venda feita pelo link de uma afiliada. A comissão só conta depois de "pago".
 * Nunca derruba o checkout: sem configuração ou com falha de rede, apenas não avisa.
 */
export async function notifyAffiliateSale(p: { orderId: number; status: AffiliateSaleStatus; ref?: string | null; totalCents?: number }) {
  const base = env("AFFILIATE_APP_URL");
  const secret = env("AFFILIATE_SITE_SECRET");
  if (!base || !secret) return false;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/public/afiliadas/venda`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ order_id: String(p.orderId), status: p.status, ref: p.ref ?? undefined, total_cents: p.totalCents }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (e) {
    console.error("[afiliada]", e);
    return false;
  }
}
