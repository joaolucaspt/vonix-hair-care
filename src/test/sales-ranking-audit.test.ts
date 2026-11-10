import { describe, expect, it } from "vitest";
import { BEST_SELLERS, getProduct, products } from "@/lib/store";
import { SALES_SNAPSHOT_DATE, soldFor, topSoldSlugs } from "@/lib/sales";

describe("vitrine Mais Vendidos baseada no histórico informado", () => {
  it("mantém uma data de referência explícita em vez de anunciar estoque ao vivo", () => {
    expect(SALES_SNAPSHOT_DATE).toBe("03/11/2026");
  });

  it("ranqueia produtos ativos pelo total informado, sem incluir SKU indisponível ou desconhecido", () => {
    const ranked = topSoldSlugs(products.map((p) => p.slug));
    expect(ranked).toEqual(BEST_SELLERS);
    expect(ranked).toHaveLength(6);
    expect(ranked[0]).toBe("botox-vonix");
    expect(ranked[1]).toBe("kit-banana-e-mel");
    expect(ranked[2]).toBe("kit-cronograma-capilar");
    expect(ranked.every((slug) => !!getProduct(slug) && soldFor(slug) > 0)).toBe(true);
    expect(ranked.map(soldFor)).toEqual([...ranked.map(soldFor)].sort((a, b) => b - a));
    expect(ranked).not.toContain("plex-vonix");
    expect(ranked).not.toContain("botox-line");
  });

  it("mantém empate pela ordem do catálogo, deduplica slugs e não altera a entrada", () => {
    const entries = [
      "kit-whey-protein",
      "mascara-efeito-teia-coco-nutri",
      "kit-whey-protein",
      "nao-existe",
      "plex-vonix",
    ];
    const original = [...entries];
    expect(topSoldSlugs(entries, 2)).toEqual([
      "kit-whey-protein",
      "mascara-efeito-teia-coco-nutri",
    ]);
    expect(entries).toEqual(original);
    expect(topSoldSlugs(entries, 0)).toEqual([]);
  });

  it("não inventa unidades para produtos sem histórico de venda", () => {
    expect(soldFor("nao-existe")).toBe(0);
    expect(soldFor("plex-vonix")).toBe(0);
  });
});
