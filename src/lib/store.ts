import { useSyncExternalStore } from "react";
import raw from "@/data/products.json";
import { topSoldSlugs } from "@/lib/sales";

export type Variant = { label: string; price: number };
export type Product = {
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  short: string;
  description: string;
  images: string[];
  variants: [Variant, ...Variant[]];
  compareBase: number | null;
  reviews: number;
};

/** Produtos sem estoque por enquanto: saem da loja, do sitemap e do catálogo da Meta. Para voltar, é só remover o slug daqui. */
export const OUT_OF_STOCK = new Set<string>(["plex-vonix"]);
export const products = (raw as unknown as Product[]).filter((p) => !OUT_OF_STOCK.has(p.slug));
export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const FREE_SHIPPING_ABOVE = 150;
export const MAX_INSTALLMENTS = 6;
export const PIX_DISCOUNT = 0.05;
export const WHATSAPP =
  "https://wa.me/5531990086296?text=Ol%C3%A1%2C+vim+do+site+e+preciso+de+ajuda.";

export const SITE_URL = "https://vonixhair.com";
export const INSTAGRAM = "https://www.instagram.com/vonixhairoficial";
export const FACEBOOK = "https://www.facebook.com/vonixhairoficial";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const cents = (v: number) => Math.round(v * 100);

/** Pix price derived from the (new) sale price. */
export const pixPrice = (v: number) => Math.round((cents(v) * 95) / 100) / 100;

/** Splits a total into up to 6 interest-free parcels; the first absorbs leftover cents. */
export function installments(total: number, n = MAX_INSTALLMENTS) {
  const t = cents(total);
  const base = Math.floor(t / n);
  const first = t - base * (n - 1);
  return { count: n, value: base / 100, first: first / 100 };
}

/** Free shipping strictly ABOVE R$ 150,00 of product subtotal BEFORE discounts, subject to carrier availability. */
export const hasFreeShipping = (subtotal: number) => subtotal > FREE_SHIPPING_ABOVE;

const CEP_KEY = "vonix-cep";
export const getSavedCep = () => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(CEP_KEY) ?? "";
  } catch {
    // Optional cache: blocked storage must not crash checkout initialization.
    return "";
  }
};
export const saveCep = (cep: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CEP_KEY, cep);
  } catch {
    // The entered CEP stays in the form even when the cache is unavailable.
  }
};
export const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
export const missingForFreeShipping = (subtotal: number) =>
  hasFreeShipping(subtotal) ? 0 : Math.max(0, cents(FREE_SHIPPING_ABOVE + 0.01 - subtotal) / 100);

/** What the customer gets in the item: kit piece count (from "O QUE VEM NO KIT") and/or the size(s). */
export function contentLabel(p: Product, short = false) {
  const sizes = [
    ...new Set(
      p.variants
        .map((v) =>
          v.label
            .replace(/^[^\d]*/, "")
            .replace(/\s+/g, "")
            .trim(),
        )
        .filter(Boolean),
    ),
  ];
  const sizeText = sizes.join(" · ");
  if (p.category === "kits") {
    const block = p.description.match(/\*\*O QUE VEM NO (?:KIT|COMBO)\*\*\s*([\s\S]*?)\n---/)?.[1];
    const n = block ? block.split("\n").filter((l) => l.trim().startsWith("**")).length : 0;
    if (n) return `${short ? "" : "Kit com "}${n} produtos${sizeText ? ` · ${sizeText}` : ""}`;
    return sizeText ? `Kit · ${sizeText}` : "Kit";
  }
  return sizeText;
}

export const discountPct = (compare: number | null, price: number) =>
  compare && compare > price ? Math.round((1 - price / compare) * 100) : 0;

/* ---------- professional classification (explicit metadata) ---------- */
/**
 * Salon-only products: progressivas and the Fio de Luz line (user-confirmed),
 * plus items whose own description/short text confirms salon use.
 * Everything else is "both" (home + professional).
 */
export const PRO_ONLY = new Set([
  "progressiva-fio-de-luz",
  "progressiva-diamond",
  "progressiva-lift-em-gel",
  "progressiva-vonix-special-matizadora",
  "shampoo-fio-de-luz-anti-residuo",
  "botox-vonix",
  "kit-cauterizacao",
]);
export const isProOnly = (slug: string) => PRO_ONLY.has(slug);

/* ---------- line offers: 5% cart complement, salon promotions 2un/12% and 3un/15% ---------- */
export type Offer = "comp5" | "kit2" | "kit3";
export const OFFER_LABEL: Record<Offer, string> = {
  comp5: "5% OFF neste item",
  kit2: "Kit 2 unidades · 12% OFF",
  kit3: "Kit 3 unidades · 15% OFF",
};

/**
 * Volume discount, every product: 2 units = 12% off, 3 or more = 15% off, on all units of the line.
 * It follows the QUANTITY, so it applies wherever the quantity changes (product page, cart, checkout, server).
 */
export const volumePct = (qty: number) => (qty >= 3 ? 15 : qty === 2 ? 12 : 0);

/** Line totals in cents-safe math. Without an offer the volume discount follows qty; kit2/kit3 (old carts) count kits, comp5 is the 5% cart complement. */
export function lineTotals(price: number, qty: number, offer?: Offer) {
  const u = cents(price);
  if (offer === "kit2") {
    const kit = Math.round((u * 2 * 88) / 100);
    return { gross: (u * 2 * qty) / 100, net: (kit * qty) / 100, units: 2 * qty };
  }
  if (offer === "kit3") {
    const kit = Math.round((u * 3 * 85) / 100);
    return { gross: (u * 3 * qty) / 100, net: (kit * qty) / 100, units: 3 * qty };
  }
  // A complement earns 5% only as a single unit. From two units onward,
  // the 12%/15% volume offer is better and must always take precedence.
  if (offer === "comp5" && qty === 1) {
    const unit = Math.round((u * 95) / 100);
    return { gross: (u * qty) / 100, net: (unit * qty) / 100, units: qty };
  }
  const gross = u * qty;
  return {
    gross: gross / 100,
    net: Math.round((gross * (100 - volumePct(qty))) / 100) / 100,
    units: qty,
  };
}

/** A line is "on offer" when it carries a line offer OR the volume discount made it cheaper: then Pix 5% and coupons do not stack. */
export const lineHasOffer = (l: { net: number; gross: number; offer?: Offer | undefined }) =>
  !!l.offer || l.net < l.gross;

/* ---------- persistent cart & favorites ---------- */
export type CartItem = { slug: string; variant: string; qty: number; offer?: Offer };

/**
 * Old carts kept "combos" (kit2/kit3 = N kits). Now the discount follows the quantity, so a combo becomes plain units
 * (merged with the same product's units) and the volume discount is recalculated from the total.
 */
export function migrateCart(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  const valid: CartItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const i = raw as { slug?: unknown; variant?: unknown; qty?: unknown; offer?: unknown };
    if (
      typeof i.slug !== "string" ||
      typeof i.variant !== "string" ||
      typeof i.qty !== "number" ||
      !Number.isSafeInteger(i.qty) ||
      i.qty <= 0
    )
      continue;
    // Do not keep unavailable catalog items, retired variants or bad entries.
    const p = getProduct(i.slug);
    if (!p || !p.variants.some((v) => v.label === i.variant)) continue;
    const offer =
      i.offer === "kit2" || i.offer === "kit3" || i.offer === "comp5" ? i.offer : undefined;
    const units = Math.min(99, i.qty * (offer === "kit2" ? 2 : offer === "kit3" ? 3 : 1));
    valid.push({
      slug: i.slug,
      variant: i.variant,
      qty: units,
      ...(offer === "comp5" ? { offer } : {}),
    });
  }

  // A complement offer is valid only if the remaining base basket qualifies.
  const bases = valid.filter((i) => i.offer !== "comp5").map((i) => i.slug);
  const eligible = new Set(bases.length ? complementsFor(bases).map((p) => p.slug) : []);
  const normalized: CartItem[] = [];
  for (const i of valid) {
    const offer = i.offer === "comp5" && eligible.has(i.slug) && i.qty === 1 ? "comp5" : undefined;
    const existing = normalized.find(
      (o) => o.slug === i.slug && o.variant === i.variant && o.offer === offer,
    );
    if (existing) {
      existing.qty = Math.min(99, existing.qty + i.qty);
      if (existing.qty >= 2) delete existing.offer;
    } else
      normalized.push({
        slug: i.slug,
        variant: i.variant,
        qty: i.qty,
        ...(offer ? { offer } : {}),
      });
  }
  return normalized;
}

/** Non-PII notice marker when a saved basket is revalidated. */
export const CART_REVALIDATED_KEY = "vonix-cart-revalidated-v1";

/** "session" storage forgets the choice when the visit ends, so the visitor chooses again next time. */
function createStore<T>(
  key: string,
  initial: T,
  kind: "local" | "session" = "local",
  migrate?: (s: T) => T,
) {
  let state = initial;
  let loaded = false;
  const subs = new Set<() => void>();
  const storage = () => (kind === "session" ? sessionStorage : localStorage);
  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const s = storage().getItem(key);
      if (s) {
        const stored: T = JSON.parse(s);
        state = migrate ? migrate(stored) : stored;
        if (migrate && JSON.stringify(stored) !== JSON.stringify(state)) {
          try {
            storage().setItem(key, JSON.stringify(state));
            if (key === "vonix-cart") sessionStorage.setItem(CART_REVALIDATED_KEY, "1");
          } catch {
            // In-memory normalized cart remains safe in restricted browsers.
          }
        }
      }
    } catch {
      /* ignore */
    }
  };
  /** Reconcile edits from other tabs before allowing another cart action. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key && event.key !== null) return;
    try {
      if (event.storageArea !== storage()) return;
      const parsed: T = event.newValue === null ? initial : JSON.parse(event.newValue);
      const updated = migrate ? migrate(parsed) : parsed;
      if (key === "vonix-cart" && migrate && JSON.stringify(parsed) !== JSON.stringify(updated)) {
        try {
          sessionStorage.setItem(CART_REVALIDATED_KEY, "1");
        } catch {
          /* optional notice */
        }
      }
      if (JSON.stringify(updated) === JSON.stringify(state)) return;
      state = updated;
    } catch {
      // Browser storage can be malformed or unavailable. Never crash the shop.
      if (JSON.stringify(state) === JSON.stringify(initial)) return;
      state = initial;
    }
    subs.forEach((notify) => notify());
  };
  return {
    get: () => {
      load();
      return state;
    },
    server: () => initial,
    set: (fn: (s: T) => T) => {
      load();
      const proposed = fn(state);
      state = migrate ? migrate(proposed) : proposed;
      if (migrate && JSON.stringify(proposed) !== JSON.stringify(state)) {
        try {
          sessionStorage.setItem(CART_REVALIDATED_KEY, "1");
        } catch {
          /* private mode */
        }
      }
      try {
        storage().setItem(key, JSON.stringify(state));
      } catch {
        // Private/blocked/full storage must not prevent cart updates in this tab.
        // A reload cannot restore an in-memory-only cart.
      }
      subs.forEach((f) => f());
    },
    sub: (f: () => void) => {
      subs.add(f);
      if (subs.size === 1 && typeof window !== "undefined")
        window.addEventListener("storage", onStorage);
      return () => {
        subs.delete(f);
        if (!subs.size && typeof window !== "undefined")
          window.removeEventListener("storage", onStorage);
      };
    },
  };
}

const cartStore = createStore<CartItem[]>("vonix-cart", [], "local", migrateCart);
/** Only active catalog slugs may be restored as favorites from untrusted browser storage. */
export function migrateFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value.slice(0, 500)) {
    if (typeof entry !== "string" || seen.has(entry) || !getProduct(entry)) continue;
    seen.add(entry);
    result.push(entry);
    if (result.length >= products.length) break;
  }
  return result;
}
const favStore = createStore<string[]>("vonix-favs", [], "local", migrateFavorites);

/** False while the page is server-rendered/hydrating, so pages that depend on localStorage don't flash an empty state. */
export const useHydrated = () =>
  useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

export function useCart() {
  const items = useSyncExternalStore(cartStore.sub, cartStore.get, cartStore.server);
  const lines = items
    .map((i) => {
      const p = getProduct(i.slug);
      const v = p?.variants.find((x) => x.label === i.variant) ?? p?.variants[0];
      if (!p || !v) return null;
      const t = lineTotals(v.price, i.qty, i.offer);
      const pct = t.gross > 0 ? Math.round((1 - t.net / t.gross) * 100) : 0;
      return {
        ...i,
        product: p,
        price: v.price,
        gross: t.gross,
        net: t.net,
        units: t.units,
        total: t.net,
        pct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const subtotal = cents(lines.reduce((s, l) => s + l.gross, 0)) / 100;
  const netSubtotal = cents(lines.reduce((s, l) => s + l.net, 0)) / 100;
  const count = lines.reduce((s, l) => s + l.units, 0);
  const key = (i: { slug: string; variant: string; offer?: Offer | undefined }) =>
    `${i.slug}|${i.variant}|${i.offer ?? ""}`;
  return {
    lines,
    subtotal,
    netSubtotal,
    count,
    add: (slug: string, variant: string, qty = 1, offer?: Offer) =>
      cartStore.set((s) => {
        const k = key({ slug, variant, offer });
        const ex = s.find((i) => key(i) === k);
        return ex
          ? s.map((i) => (key(i) === k ? { ...i, qty: Math.min(99, i.qty + qty) } : i))
          : [...s, { slug, variant, qty: Math.min(99, qty), ...(offer ? { offer } : {}) }];
      }),
    setQty: (slug: string, variant: string, qty: number, offer?: Offer) =>
      cartStore.set((s) => {
        const k = key({ slug, variant, offer });
        return qty <= 0
          ? s.filter((i) => key(i) !== k)
          : s.map((i) => (key(i) === k ? { ...i, qty: Math.min(99, qty) } : i));
      }),
    remove: (slug: string, variant: string, offer?: Offer) =>
      cartStore.set((s) => {
        const k = key({ slug, variant, offer });
        return s.filter((i) => key(i) !== k);
      }),
    clear: () => cartStore.set(() => []),
  };
}

export function useFavorites() {
  const favs = useSyncExternalStore(favStore.sub, favStore.get, favStore.server);
  return {
    favs,
    has: (s: string) => favs.includes(s),
    toggle: (s: string) =>
      favStore.set((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s])),
  };
}

export const NEEDS: Record<string, RegExp> = {
  Hidratação: /hidrat/i,
  Reconstrução: /reconstru|reparação|repair|queratina/i,
  "Controle de Frizz": /frizz/i,
  "Definição de Cachos": /cacho/i,
  "Cabelos com Química": /química|quimica|loir|coloração|matiz/i,
  Nutrição: /nutri/i,
};
export const TYPES: Record<string, (p: Product) => boolean> = {
  Progressiva: (p) => /progressiva/i.test(p.name),
  Máscara: (p) => /máscara/i.test(p.name),
  Kits: (p) => p.category === "kits",
  Finalizadores: (p) => p.category === "finalizadores",
};
/** Historical merchant-reported sales ranking: do not describe as live inventory or real-time best sellers. */
export const BEST_SELLERS = topSoldSlugs(
  products.map((p) => p.slug),
  6,
);

export const MAX_DISCOUNT = Math.max(
  ...products.map((p) => discountPct(p.compareBase, p.variants[0].price)),
);

/**
 * Order totals in cents, line-aware.
 * - Free shipping: product subtotal BEFORE any discount strictly above R$ 150.
 * - Line offers (comp5/kit2/kit3) are already baked into each line's net and
 *   are NEVER cumulative: Pix 5% and coupons apply only to lines without an offer.
 */
export function checkoutTotals(
  lines: { gross: number; net: number; offer?: Offer | undefined }[],
  method: "pix" | "card",
  couponPct = 0,
) {
  const gross = cents(lines.reduce((s, l) => s + l.gross, 0));
  const net = cents(lines.reduce((s, l) => s + l.net, 0));
  const eligible = cents(lines.reduce((s, l) => s + (lineHasOffer(l) ? 0 : l.net), 0));
  const couponDisc = Math.round(eligible * couponPct);
  const pixDisc =
    method === "pix"
      ? Math.round(((eligible - couponDisc) * 95) / 100) - (eligible - couponDisc)
      : 0;
  const total = net - couponDisc + pixDisc;
  return {
    gross: gross / 100,
    offerDiscount: (gross - net) / 100,
    couponDiscount: couponDisc / 100,
    pixDiscount: (-pixDisc + 0) / 100,
    discount: (gross - total) / 100,
    net: total / 100,
    freeShipping: gross > FREE_SHIPPING_ABOVE * 100,
    hasOffers: lines.some(lineHasOffer),
  };
}

/* ---------- audience shortcut (casa / salão), persisted per browser ---------- */
export type Audience = "casa" | "salao" | null;
export const resolveAudience = (saved: Audience, uso?: string): Audience =>
  uso === "casa" || uso === "salao" ? uso : saved;

/**
 * "Buy more" promotions (buy 2 = 12% off, buy 3 = 15% off) apply to every product on the whole site
 * (home and salon areas alike), ready-made kits included. No extra 5% on single units.
 */
export const hasProPromo = (_p: Product) => true;

/** Display only: price is always the catalog price; the buy-more promotions are chosen on the product page. */
export function cardPricing(p: Product, _audience: Audience) {
  const price = p.variants[0].price;
  return {
    professional: hasProPromo(p),
    price,
    pix: pixPrice(price),
    parcels: installments(price),
  };
}
/** A cached audience must never become an arbitrary object or obsolete value. */
export const migrateAudience = (value: unknown): Audience =>
  value === "casa" || value === "salao" ? value : null;
const audienceStore = createStore<Audience>("vonix-audience", null, "session", migrateAudience);

/** Chemical-service products (progressivas, botox, selagem): they go last in the home area. */
const isChemicalLine = (p: Product) =>
  isProOnly(p.slug) || p.category === "quimica" || p.slug.startsWith("selagem");

/**
 * Both areas list every product; only the order changes (stable within each group):
 * - casa: home products first, the rest next, progressivas/botox at the end;
 * - salão: professional products first (by professional relevance), home products at the bottom.
 */
export const forAudience = (items: Product[], audience: Audience) => {
  if (audience === "casa") {
    const rank = (p: Product) => (USAGE["casa"]?.(p) ? 0 : isChemicalLine(p) ? 2 : 1);
    return [...items].sort((a, b) => rank(a) - rank(b));
  }
  if (audience === "salao") {
    const pro = professionalRelevance(items.filter((p) => USAGE["salao"]?.(p)));
    return [...pro, ...items.filter((p) => !USAGE["salao"]?.(p))];
  }
  return items;
};
export function useAudience() {
  const audience = useSyncExternalStore(audienceStore.sub, audienceStore.get, audienceStore.server);
  return { audience, set: (a: Audience) => audienceStore.set(() => a) };
}

/** Usage filters based only on indications confirmed in the catalog descriptions. */
/** Home / salon indications, fixed explicitly so editing a product's copy never changes where it is listed. */
const CASA_TEXT = new Set([
  "progressiva-fio-de-luz",
  "mascara-reparacao-nutri-repair",
  "kit-banana-e-mel",
  "kit-cronograma-capilar",
  "kit-whey-protein",
  "kit-desmaia",
  "mascara-hidratacao-lanolina-karite",
  "mascara-efeito-teia-tomba-cabelo",
  "mascara-efeito-teia-coco-nutri",
  "mascara-efeito-teia-anabolizante",
  "kit-coco-nutri",
  "mousse-flash",
  "mascara-efeito-teia-desmaia-cabelo",
  "kit-matizador-shampoo-e-mascara",
  "shampoo-hidratante-dep-toc",
  "kit-cachos",
  "reparador-de-pontas",
  "serum-argan",
]);
const SALAO_TEXT = new Set([
  "progressiva-fio-de-luz",
  "botox-vonix",
  "mascara-reparacao-nutri-repair",
  "plex-vonix",
  "kit-cauterizacao",
  "mascara-hidratacao-lanolina-karite",
  "botox-line-matizador",
  "mascara-efeito-teia-tomba-cabelo",
  "mascara-efeito-teia-coco-nutri",
  "mascara-efeito-teia-anabolizante",
  "botox-vonix-matizador",
  "mascara-whey-protein",
  "mousse-flash",
  "progressiva-diamond",
  "shampoo-diamond-anti-residuo",
  "mascara-efeito-teia-desmaia-cabelo",
  "kit-matizador-shampoo-e-mascara",
  "progressiva-lift-em-gel",
  "progressiva-vonix-special-matizadora",
  "kit-cachos",
  "defrizante",
  "serum-argan",
]);
export const USAGE: Record<string, (p: Product) => boolean> = {
  casa: (p) =>
    !isProOnly(p.slug) &&
    (p.category === "kits" || p.category === "finalizadores" || CASA_TEXT.has(p.slug)),
  salao: (p) =>
    isProOnly(p.slug) ||
    (p.category === "quimica" && p.slug.startsWith("botox-")) ||
    p.category === "kits" ||
    SALAO_TEXT.has(p.slug),
};

/** Professional relevance only; stable families based on catalog identifiers, never kit text. */
export function professionalFamilyRank(p: Product) {
  if (p.category === "quimica" && p.slug.startsWith("progressiva-")) return 0;
  if (p.category === "quimica" && p.slug.startsWith("botox-")) return 1;
  if (p.category === "lavatorio" && p.slug.startsWith("shampoo-")) return 2;
  if (p.category === "finalizadores" && p.slug.startsWith("defrizante")) return 3;
  return 4;
}

export const professionalRelevance = (items: Product[]) =>
  [...items].sort((a, b) => professionalFamilyRank(a) - professionalFamilyRank(b));

/**
 * Contextual complement matrix: ordered rules keyed by what is already in the
 * cart, using only compatibilities confirmed in the catalog descriptions.
 * Never suggests a product already in the cart (any variant) nor kits
 * (kits don't get the 5% complement offer).
 */
const COMPLEMENT_RULES: [RegExp, string[]][] = [
  [
    /progressiva-fio-de-luz/,
    ["shampoo-fio-de-luz-anti-residuo", "serum-argan", "reparador-de-pontas"],
  ],
  [
    /progressiva|botox|selagem|cauterizacao/,
    ["shampoo-diamond-anti-residuo", "defrizante", "mascara-efeito-teia-tomba-cabelo"],
  ],
  [
    /kit-banana-e-mel|kit-cafe-verde|kit-coco-nutri|kit-cachos|kit-cronograma|kit-whey|kit-desmaia/,
    ["serum-argan", "defrizante", "perfume-capilar-vonix"],
  ],
  [/cacho/, ["mascara-efeito-teia-coco-nutri", "defrizante", "serum-argan"]],
  [
    /mascara|hidrat|nutri|reconstru|queratina|whey/,
    ["reparador-de-pontas", "serum-argan", "ampola-de-hidratacao-mousse-flash"],
  ],
  [/matiz/, ["kit-matizador-shampoo-e-mascara", "serum-argan"]],
];

export function complementsFor(cartSlugs: string[], max = 3): Product[] {
  const inCart = new Set(cartSlugs);
  const ordered: string[] = [];
  for (const [re, slugs] of COMPLEMENT_RULES)
    if (cartSlugs.some((s) => re.test(s))) ordered.push(...slugs);
  ordered.push(...BEST_SELLERS);
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const s of ordered) {
    if (seen.has(s) || inCart.has(s)) continue;
    seen.add(s);
    const p = getProduct(s);
    if (p && p.category !== "kits") out.push(p);
    if (out.length >= max) break;
  }
  return out;
}
