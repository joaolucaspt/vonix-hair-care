import { env } from "./env.server";
import type { Coupon } from "./coupons";

/** Desconto padrão do cupom de afiliada (o app de afiliadas confirma que a pessoa existe e está ativa). */
export const AFFILIATE_COUPON_PERCENT = 10;

const cache = new Map<string, { until: number; coupon: Coupon | null }>();
const TTL_OK = 5 * 60_000;
const TTL_NO = 60_000;

/**
 * Cupom da afiliada (ex.: MARISSOL10): só vale se o app de afiliadas confirmar. Sem configuração ou com falha de rede,
 * o cupom NÃO vale (nunca dá desconto sem confirmar), e a compra segue normal sem ele.
 */
export async function resolveAffiliateCoupon(code: string, now = Date.now()): Promise<Coupon | undefined> {
  const c = code.trim().toUpperCase();
  const hit = cache.get(c);
  if (hit && hit.until > now) return hit.coupon ?? undefined;
  const base = env("AFFILIATE_APP_URL");
  const secret = env("AFFILIATE_SITE_SECRET");
  if (!base || !secret) return undefined;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/public/afiliadas/cupom?code=${encodeURIComponent(c)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { ok?: boolean; percent?: number; name?: string };
    if (!j.ok) {
      cache.set(c, { until: now + TTL_NO, coupon: null });
      return undefined;
    }
    const first = (j.name ?? "").trim().split(/\s+/)[0] ?? "";
    const coupon: Coupon = {
      code: c,
      label: `${AFFILIATE_COUPON_PERCENT}% OFF em qualquer compra${first ? ` (cupom da ${first})` : ""}`,
      percent: AFFILIATE_COUPON_PERCENT,
    };
    cache.set(c, { until: now + TTL_OK, coupon });
    return coupon;
  } catch (e) {
    console.error("[cupom-afiliada]", e);
    return undefined;
  }
}
