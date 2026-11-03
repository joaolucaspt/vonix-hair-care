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
    expect(Object.values(SOLD).reduce((s, n) => s + n, 0)).toBe(367);
  });
  it("vendas do WhatsApp somadas às do Bling (os cinco que faltavam na 1ª lista)", () => {
    expect(soldFor("shampoo-hidratante-desmaia-cabelo")).toBe(21);
    expect(soldFor("shampoo-diamond-anti-residuo")).toBe(14);
    expect(soldFor("shampoo-hidratante-dep-toc")).toBe(29);
    expect(soldFor("mascara-efeito-teia-anabolizante")).toBe(22 + 2);
    expect(soldFor("mascara-whey-protein")).toBe(14 + 1);
  });
});
