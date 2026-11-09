import { products, type Product } from "@/lib/store";

/** Preço máximo das sugestões aleatórias: compra por impulso, de um toque. */
const MAX_PRICE = 120;

const ANTI_RESIDUO: Record<string, string> = {
  "progressiva-fio-de-luz": "shampoo-fio-de-luz-anti-residuo",
  "progressiva-diamond": "shampoo-diamond-anti-residuo",
};
const ANTI_RESIDUO_ANY = ["shampoo-fio-de-luz-anti-residuo", "shampoo-diamond-anti-residuo"];

/** Categorias que combinam com cada tipo de item que está no carrinho (a ordem não importa: sorteamos). */
const AFFINITY: Record<string, string[]> = {
  quimica: ["finalizadores", "reposicao-cauterizacao", "crescimento-queda", "hidratacao"],
  hidratacao: ["finalizadores", "lavatorio", "reposicao-cauterizacao", "crescimento-queda"],
  kits: ["finalizadores", "reposicao-cauterizacao", "crescimento-queda"],
  finalizadores: ["lavatorio", "hidratacao", "reposicao-cauterizacao"],
};
const FALLBACK = ["finalizadores", "reposicao-cauterizacao", "crescimento-queda", "lavatorio"];

const shuffle = <T>(a: T[], rand: () => number) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};

/**
 * Sugestões do "leve também": quem leva química (progressiva/botox) sempre vê o shampoo anti-resíduo primeiro
 * (o certo para a progressiva escolhida); o resto é sorteado entre categorias que combinam, a cada abertura.
 */
export function pickExtras(
  cartSlugs: string[],
  count = 3,
  rand: () => number = Math.random,
): Product[] {
  const inCart = new Set(cartSlugs);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const cartProducts = cartSlugs.map((s) => bySlug.get(s)).filter((p): p is Product => !!p);
  const out: Product[] = [];
  const take = (p: Product | undefined) => {
    if (p && !inCart.has(p.slug) && p.images[0] && !out.some((o) => o.slug === p.slug)) out.push(p);
  };

  if (
    cartProducts.some((p) => p.category === "quimica") &&
    !ANTI_RESIDUO_ANY.some((s) => inCart.has(s))
  ) {
    const chosen =
      cartSlugs.map((s) => ANTI_RESIDUO[s]).find(Boolean) ?? shuffle(ANTI_RESIDUO_ANY, rand)[0]!;
    take(bySlug.get(chosen));
  }

  const cats = new Set(cartProducts.flatMap((p) => AFFINITY[p.category] ?? FALLBACK));
  const pool = shuffle(
    products.filter(
      (p) =>
        cats.has(p.category) &&
        p.variants[0]!.price <= MAX_PRICE &&
        !inCart.has(p.slug) &&
        p.images[0],
    ),
    rand,
  );
  for (const p of pool) {
    if (out.length >= count) break;
    take(p);
  }
  // Pouca coisa combinando: completa com qualquer item barato.
  for (const p of shuffle(
    products.filter((x) => x.variants[0]!.price <= MAX_PRICE),
    rand,
  )) {
    if (out.length >= count) break;
    take(p);
  }
  return out.slice(0, count);
}
