import { brl } from "@/lib/store";

/**
 * Coupons accepted at checkout. The same list is used by the prize wheel and by the manual "Tem um cupom?" box,
 * and the server validates the code again when it prices the order. `minSubtotal` is checked against the
 * product subtotal BEFORE discounts, like the free-shipping rule.
 */
export type Coupon = {
  code: string;
  label: string;
  percent?: number;
  freeShipping?: boolean;
  minSubtotal?: number;
};

export const COUPONS: Coupon[] = [
  { code: "GIRA3", label: "3% OFF em qualquer compra", percent: 3 },
  { code: "GIRA4", label: "4% OFF em compras acima de R$ 99", percent: 4, minSubtotal: 99 },
  { code: "GIRA5", label: "5% OFF em compras acima de R$ 150", percent: 5, minSubtotal: 150 },
  { code: "GIRA6", label: "6% OFF em compras acima de R$ 250", percent: 6, minSubtotal: 250 },
  // Parceria Bela Tiozzo: só digitado à mão (link/criativos dela), nunca na roleta.
  { code: "BT10", label: "10% OFF em qualquer compra", percent: 10 },
];

/** Prize wheel: every spin wins; arc size = chance, so what you see is what you get (weights sum to 100). */
export const WHEEL: { code: string; weight: number }[] = [
  { code: "GIRA3", weight: 25 },
  { code: "GIRA4", weight: 25 },
  { code: "GIRA5", weight: 25 },
  { code: "GIRA6", weight: 25 },
];

export const findCoupon = (code?: string | null) => {
  const c = (code ?? "").trim().toUpperCase();
  return c ? COUPONS.find((x) => x.code === c) : undefined;
};

const PRIZE_KEY = "vonix-cupom";
const PRIZE_DAYS = 7;

/** The coupon won on the prize wheel is kept in this browser for a few days (it is a normal coupon, not personal data). */
export function savePrize(code: string) {
  try {
    localStorage.setItem(PRIZE_KEY, JSON.stringify({ code, until: Date.now() + PRIZE_DAYS * 864e5 }));
  } catch {
    /* storage blocked: the visitor still sees the code on screen */
  }
}
export function getPrize(): Coupon | undefined {
  try {
    const raw = localStorage.getItem(PRIZE_KEY);
    if (!raw) return undefined;
    const { code, until } = JSON.parse(raw) as { code: string; until: number };
    return until > Date.now() ? findCoupon(code) : undefined;
  } catch {
    return undefined;
  }
}
export const prizeDays = PRIZE_DAYS;

/** Is the coupon usable for this cart (product subtotal before discounts)? */
export function couponCheck(c: Coupon, grossSubtotal: number): { ok: true } | { ok: false; reason: string } {
  if (c.minSubtotal && grossSubtotal < c.minSubtotal) {
    return { ok: false, reason: `O cupom ${c.code} vale em compras acima de ${brl(c.minSubtotal)} em produtos.` };
  }
  return { ok: true };
}

/** Percent that checkoutTotals() should take off, or 0 when the coupon is not valid for the cart. */
export const couponPercent = (c: Coupon | undefined, gross: number) => (c && c.percent && couponCheck(c, gross).ok ? c.percent / 100 : 0);
export const couponFreeShipping = (c: Coupon | undefined, gross: number) => !!(c?.freeShipping && couponCheck(c, gross).ok);
