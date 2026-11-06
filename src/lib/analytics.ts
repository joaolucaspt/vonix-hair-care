import type { Product } from "@/lib/store";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** Pixel Vonix | E-commerce no Gerenciador de Eventos. */
export const META_PIXEL_ID = "2866590430205824";

type Item = { item_id: string; item_name: string; item_variant: string; price: number; quantity: number };

/** Identificador já usado nos relatórios do GA4. */
export const catalogId = (slug: string) => `VONIX-${slug.replace(/^kit-/, "combo-").toUpperCase()}`;

const META_CATALOG_IDS: Record<string, string> = {
  "VONIX-MASCARA-EFEITO-TEIA-COCO-NUTRI": "VONIX-MASCARA-COCO-NUTRI",
  "VONIX-COMBO-MATIZADOR-SHAMPOO-E-MASCARA": "VONIX-KIT-MATIZADOR",
};

/** Mantém os identificadores dos produtos que já existem no Gerenciador de Comércio. */
export const metaCatalogId = (itemId: string) =>
  META_CATALOG_IDS[itemId] ?? itemId.replace(/^VONIX-COMBO-/, "VONIX-KIT-");

export const toItem = (p: Product, variant: string, price: number, quantity = 1): Item => ({
  item_id: catalogId(p.slug),
  item_name: p.name,
  item_variant: variant,
  price,
  quantity,
});

const META_EVENTS: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  sign_up: "Lead",
};

/** Converte os parâmetros do GA4 para os da Meta (content_ids/contents com o código do catálogo). */
export function metaParams(params: Record<string, unknown>) {
  const items = (params["items"] as Item[] | undefined) ?? [];
  return {
    currency: "BRL",
    ...(typeof params["value"] === "number" ? { value: params["value"] } : {}),
    ...(items.length
      ? {
          content_type: "product",
          content_ids: items.map((i) => metaCatalogId(i.item_id)),
          contents: items.map((i) => ({ id: metaCatalogId(i.item_id), quantity: i.quantity, item_price: i.price })),
          num_items: items.reduce((s, i) => s + i.quantity, 0),
        }
      : {}),
  };
}

/** GA4 recommended e-commerce events; the same names show up as smart events in Clarity and, when set up, in the Meta Pixel. */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, { currency: "BRL", ...params });
    window.clarity?.("event", event);
    const metaEvent = META_EVENTS[event];
    if (metaEvent && window.fbq) {
      const eventID = `${event}-${params["transaction_id"] ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
      window.fbq("track", metaEvent, metaParams(params), { eventID });
    }
  } catch {
    /* tracking must never break the store */
  }
}
