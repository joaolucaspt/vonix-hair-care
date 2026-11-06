import { createFileRoute } from "@tanstack/react-router";
import { catalogId, metaCatalogId } from "@/lib/analytics";
import { products, SITE_URL } from "@/lib/store";

const HEADERS = [
  "id", "title", "description", "availability", "condition", "price", "sale_price",
  "link", "image_link", "brand",
];

const csvRow = (fields: string[]) => fields.map((field) => `"${field.replaceAll('"', '""')}"`).join(",");
const feedPrice = (price: number) => `${price.toFixed(2)} BRL`;

export const Route = createFileRoute("/api/public/meta-catalog")({
  server: {
    handlers: {
      GET: () => {
        const rows = products.flatMap((product) => {
          const image = product.images[0];
          if (!image) return [];

          const price = product.variants[0].price;
          const comparePrice = product.compareBase && product.compareBase > price ? product.compareBase : null;
          return [csvRow([
            metaCatalogId(catalogId(product.slug)),
            product.name,
            product.short,
            "in stock",
            "new",
            feedPrice(comparePrice ?? price),
            comparePrice ? feedPrice(price) : "",
            `${SITE_URL}/produto/${product.slug}`,
            new URL(image, SITE_URL).href,
            "Vonix Hair",
          ])];
        });

        return new Response(`${[csvRow(HEADERS), ...rows].join("\r\n")}\r\n`, {
          headers: { "content-type": "text/csv; charset=utf-8" },
        });
      },
    },
  },
});
