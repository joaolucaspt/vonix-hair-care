import type { Product } from "@/lib/store";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

type Item = { item_id: string; item_name: string; item_variant: string; price: number; quantity: number };

export const toItem = (p: Product, variant: string, price: number, quantity = 1): Item => ({
  item_id: p.slug,
  item_name: p.name,
  item_variant: variant,
  price,
  quantity,
});

/** GA4 recommended e-commerce events; the same names show up as smart events in Clarity. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, { currency: "BRL", ...params });
    window.clarity?.("event", event);
  } catch {
    /* tracking must never break the store */
  }
}
