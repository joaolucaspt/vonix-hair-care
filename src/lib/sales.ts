import raw from "@/data/vendas.json";

/** Real units sold per product (from Bling orders, see src/data/vendas.json). Products with no sales return 0, never an estimate. */
export const SOLD: Record<string, number> = raw.unidades;
export const soldFor = (slug: string) => SOLD[slug] ?? 0;
