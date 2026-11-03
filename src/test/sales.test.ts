import { describe, expect, it } from "vitest";
import { products } from "@/lib/store";
import { SOLD, soldFor } from "@/lib/sales";

describe("vendas reais", () => {
  it("só conta produtos que existem no catálogo, com unidades inteiras positivas", () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const [slug, n] of Object.entries(SOLD)) {
      expect(slugs.has(slug)).toBe(true);
      expect(Number.isInteger(n) && n > 0).toBe(true);
    }
  });
  it("produto sem venda registrada mostra 0, nunca um número estimado", () => {
    expect(soldFor("produto-que-nao-existe")).toBe(0);
    expect(soldFor("progressiva-fio-de-luz")).toBe(21);
    expect(Object.values(SOLD).reduce((s, n) => s + n, 0)).toBe(484);
  });
  it("o total que o dono informa por produto vale como está, sem somar com o Bling", () => {
    const informado: Record<string, number> = {
      "kit-banana-e-mel": 43,
      "mascara-efeito-teia-coco-nutri": 25,
      "botox-vonix": 58,
      "kit-cronograma-capilar": 32,
      "kit-whey-protein": 25,
      "mascara-efeito-teia-anabolizante": 22,
      "mascara-whey-protein": 14,
      "shampoo-hidratante-desmaia-cabelo": 21,
      "shampoo-diamond-anti-residuo": 14,
      "shampoo-hidratante-dep-toc": 29,
    };
    for (const [slug, n] of Object.entries(informado)) expect(soldFor(slug)).toBe(n);
  });
});
