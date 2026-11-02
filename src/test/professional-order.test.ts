import { describe, expect, it } from "vitest";
import { getProduct, isProOnly, products, professionalFamilyRank, professionalRelevance, USAGE } from "@/lib/store";

describe("relevância para cabeleireiras", () => {
  const available = products.filter((p) => USAGE["salao"]?.(p));
  const ordered = professionalRelevance(available);
  it("todas as progressivas vêm primeiro, na ordem do catálogo", () => {
    expect(ordered.slice(0, 4).map((p) => p.slug)).toEqual([
      "progressiva-fio-de-luz", "progressiva-diamond", "progressiva-lift-em-gel", "progressiva-vonix-special-matizadora",
    ]);
  });
  it("todos os Botox vêm depois, incluindo Line e Matizadores sem nova promoção", () => {
    expect(ordered.slice(4, 8).map((p) => p.slug)).toEqual([
      "botox-vonix", "botox-line", "botox-line-matizador", "botox-vonix-matizador",
    ]);
    expect(isProOnly("botox-line")).toBe(false);
  });
  it("shampoos avulsos disponíveis vêm antes de defrizante e demais; kit não é shampoo", () => {
    expect(ordered.slice(8, 11).map((p) => p.slug)).toEqual([
      "shampoo-fio-de-luz-anti-residuo", "shampoo-diamond-anti-residuo", "defrizante",
    ]);
    const kit = getProduct("kit-matizador-shampoo-e-mascara");
    if (!kit) throw new Error("Kit obrigatório ausente");
    expect(professionalFamilyRank(kit)).toBe(4);
  });
  it("ordem é estável e preserva todos os itens disponíveis", () => {
    expect(ordered.map((p) => p.slug).sort()).toEqual(available.map((p) => p.slug).sort());
    expect(ordered.filter((p) => professionalFamilyRank(p) === 4)).toEqual(available.filter((p) => professionalFamilyRank(p) === 4));
  });
});