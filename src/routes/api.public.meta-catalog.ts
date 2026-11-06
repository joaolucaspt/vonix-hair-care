import { createFileRoute } from "@tanstack/react-router";
import { catalogId } from "@/lib/analytics";
import { SITE_URL, products } from "@/lib/store";

/**
 * Feed de produtos para o Catálogo da Meta (Gerenciador de Comércio → Fontes de dados → Arquivo de dados).
 * Usa os mesmos preços do site (products.json), então catálogo e página nunca divergem.
 *
 * Endereço para cadastrar na Meta: https://vonixhair.com/api/public/meta-catalog
 * Os ids vêm de catalogId() (o mesmo código dos eventos do pixel: VONIX-BOTOX-VONIX, VONIX-COMBO-BANANA-E-MEL...),
 * para atualizar os itens que já existem no catálogo.
 */
const COLUMNS = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "brand", "product_type"] as const;

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
const money = (v: number) => `${v.toFixed(2)} BRL`;
const clean = (v: string) => v.replace(/\s+/g, " ").trim();

export const buildMetaCatalogCsv = () => {
  const rows = products.map((p) => {
    const price = p.variants[0].price;
    const hasCompare = p.compareBase !== null && p.compareBase > price;
    const cells: Record<(typeof COLUMNS)[number], string> = {
      id: catalogId(p.slug),
      title: `Vonix Hair ${p.name}`,
      description: clean(p.description || p.short || p.name).slice(0, 4900),
      availability: "in stock",
      condition: "new",
      price: money(hasCompare ? (p.compareBase as number) : price),
      sale_price: hasCompare ? money(price) : "",
      link: `${SITE_URL}/produto/${p.slug}`,
      image_link: `${SITE_URL}${p.images[0] ?? ""}`,
      brand: "Vonix Hair",
      product_type: p.categoryLabel,
    };
    return COLUMNS.map((c) => csvCell(cells[c])).join(",");
  });
  return [COLUMNS.join(","), ...rows].join("\n") + "\n";
};

export const Route = createFileRoute("/api/public/meta-catalog")({
  server: {
    handlers: {
      GET: () =>
        new Response(buildMetaCatalogCsv(), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        }),
    },
  },
});
