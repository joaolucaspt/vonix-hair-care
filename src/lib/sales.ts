import raw from "@/data/vendas.json";

/** Merchant-reported historical sales through 2026-11-03. Not live sales or inventory availability. */
export const SALES_SNAPSHOT_DATE = "03/11/2026";
export const SOLD: Record<string, number> = raw.unidades;
export const soldFor = (slug: string) => {
  const value = SOLD[slug];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
};

/** Top active catalog slugs by recorded units; tie order is the stable catalog order. */
export function topSoldSlugs(catalogSlugs: readonly string[], limit = 6): string[] {
  return [...new Set(catalogSlugs)]
    .filter((slug) => soldFor(slug) > 0)
    .sort((a, b) => soldFor(b) - soldFor(a))
    .slice(0, Math.max(0, Math.floor(limit)));
}
