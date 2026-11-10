import { env } from "./env.server";
import type { Coupon } from "./coupons";

/** Endereço público do app de afiliadas (só confirma que o cupom existe; não precisa de segredo). Dá para trocar por AFFILIATE_COUPON_URL. */
const COUPON_URL = "https://vonix-expedicao-facil.lovable.app";

/** Desconto padrão do cupom de afiliada (o app de afiliadas confirma que a pessoa existe e está ativa). */
export const AFFILIATE_COUPON_PERCENT = 10;

const cache = new Map<string, { until: number; coupon: Coupon | null }>();
const TTL_OK = 5 * 60_000;
const TTL_NO = 60_000;

/**
 * Cupom da afiliada (ex.: MARISSOL10): só vale se o app de afiliadas confirmar. Sem configuração ou com falha de rede,
 * o cupom NÃO vale (nunca dá desconto sem confirmar), e a compra segue normal sem ele.
 */
export let lastAffiliateLookupError = "";

export async function resolveAffiliateCoupon(code: string, now = Date.now()): Promise<Coupon | undefined> {
  const c = code.trim().toUpperCase();
  const hit = cache.get(c);
  if (hit && hit.until > now) return hit.coupon ?? undefined;
  const base = env("AFFILIATE_COUPON_URL") || COUPON_URL;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/public/afiliadas/cupom?code=${encodeURIComponent(c)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      lastAffiliateLookupError = `http ${res.status}`;
      return undefined;
    }
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
    lastAffiliateLookupError = `erro ${e instanceof Error ? e.message : String(e)}`;
    console.error("[cupom-afiliada]", e);
    return undefined;
  }
}
