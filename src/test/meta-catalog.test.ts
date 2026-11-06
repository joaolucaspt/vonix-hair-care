import { describe, expect, it } from "vitest";
import { buildMetaCatalogCsv } from "@/routes/api.public.meta-catalog";
import { products } from "@/lib/store";

const parse = (csv: string) => {
  const lines = csv.trim().split("\n");
  const cols = lines[0]!.split(",");
  return lines.slice(1).map((l) => {
    const cells = l.slice(1, -1).split('","');
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
};

describe("feed do catálogo da Meta", () => {
  const rows = parse(buildMetaCatalogCsv());

  it("tem uma linha por produto do site", () => {
    expect(rows).toHaveLength(products.length);
  });

  it("usa o preço atual do site como preço de venda", () => {
    const botox = rows.find((r) => r.id === "VONIX-BOTOX-VONIX")!;
    expect(botox.sale_price).toBe("164.90 BRL");
    expect(botox.price).toBe("197.90 BRL");
    expect(botox.link).toBe("https://vonixhair.com/produto/botox-vonix");
  });

  it("todo item tem link, imagem e o código de catálogo dos eventos", () => {
    for (const r of rows) {
      expect(r.id).toMatch(/^VONIX-[A-Z0-9-]+$/);
      expect(r.link).toMatch(/^https:\/\/vonixhair\.com\/produto\//);
      expect(r.image_link).toMatch(/^https:\/\/vonixhair\.com\/images\//);
    }
  });
});
