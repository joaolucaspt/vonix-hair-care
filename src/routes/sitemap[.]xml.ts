import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, products } from "@/lib/store";

const PAGES = ["", "/loja", "/sobre", "/contato", "/politica-de-trocas-e-devolucoes", "/politica-de-frete", "/politica-de-privacidade", "/termos-de-uso"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = [...PAGES, ...products.map((p) => `/produto/${p.slug}`)]
          .map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
