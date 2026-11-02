import { describe, expect, it } from "vitest";
import { USAGE, cardPricing, forAudience, resolveAudience, checkoutTotals, complementsFor, getProduct, hasFreeShipping, installments, isProOnly, lineTotals, pixPrice, products } from "@/lib/store";

describe("ambiente e preços dos cards", () => {
  it("links sem uso ou com uso legado não limpam o ambiente escolhido", () => {
    expect(resolveAudience("casa")).toBe("casa");
    expect(resolveAudience("casa", "pessoal")).toBe("casa");
    expect(resolveAudience("salao")).toBe("salao");
    expect(resolveAudience(null)).toBe(null);
  });
  it("Fio de Luz no salão não tem 5% profissional: preço de catálogo, Pix normal e promoção de kits", () => {
    const p = getProduct("progressiva-fio-de-luz");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({ professional: true, price: 174.9, pix: 166.16, parcels: { count: 6, value: 29.15, first: 29.15 } });
    expect(cardPricing(p, "casa").price).toBe(174.9);
  });
  it("kits prontos também têm a promoção de levar 2 ou 3 no salão, sem 5% extra", () => {
    const p = getProduct("kit-banana-e-mel");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({ professional: true, price: 154.9, pix: 147.16 });
    expect(cardPricing(p, "casa").professional).toBe(false);
  });
  it("todo produto vendido na área de salão tem a promoção", () => {
    for (const p of products) expect(cardPricing(p, "salao").professional).toBe(true);
  });
  it("as duas áreas listam todos os produtos, só muda a ordem", () => {
    for (const a of ["casa", "salao"] as const) {
      const l = forAudience(products, a);
      expect(l.length).toBe(products.length);
      expect(new Set(l.map((p) => p.slug)).size).toBe(products.length);
    }
  });
  it("cuidado em casa: produtos de casa primeiro e progressivas/botox no final", () => {
    const l = forAudience(products, "casa");
    const first = l.findIndex((p) => !USAGE["casa"]?.(p));
    expect(l.slice(0, first).every((p) => USAGE["casa"]?.(p))).toBe(true);
    const lastSlugs = l.slice(-6).map((p) => p.slug);
    expect(lastSlugs.some((s) => s.startsWith("progressiva-") || s.startsWith("botox-"))).toBe(true);
    expect(l.findIndex((p) => p.slug === "progressiva-fio-de-luz")).toBeGreaterThan(l.findIndex((p) => p.slug === "kit-cafe-verde"));
  });
  it("área de salão: profissionais primeiro e produtos de casa embaixo", () => {
    const l = forAudience(products, "salao");
    expect(l[0]?.slug).toBe("progressiva-fio-de-luz");
    const firstHome = l.findIndex((p) => !USAGE["salao"]?.(p));
    expect(l.slice(firstHome).every((p) => !USAGE["salao"]?.(p))).toBe(true);
  });
});

describe("regras comerciais", () => {
  it("catálogo tem 43 produtos", () => expect(products.length).toBe(43));
  it("preço já inclui +15 uma vez", () => {
    expect(getProduct("progressiva-fio-de-luz")!.variants[0]?.price).toBe(174.9);
    expect(getProduct("kit-cachos")!.variants.map((v) => v.price)).toEqual([74.9, 194.9]);
  });
  it("frete grátis somente acima de 150", () => {
    expect(hasFreeShipping(150)).toBe(false);
    expect(hasFreeShipping(150.01)).toBe(true);
  });
  it("6x sem juros soma o total exato", () => {
    const i = installments(174.9);
    expect(i.count).toBe(6);
    expect(Math.round((i.first + i.value * 5) * 100)).toBe(17490);
  });
  it("Pix 5% sobre o novo preço", () => expect(pixPrice(174.9)).toBe(166.16));
});

describe("ofertas por linha (não cumulativas)", () => {
  it("Fio de Luz no salão: 1un 174,90 / leve 2 (12%) 307,82 / leve 3 (15%) 446,00", () => {
    expect(lineTotals(174.9, 1)).toMatchObject({ net: 174.9, gross: 174.9, units: 1 });
    expect(lineTotals(174.9, 1, "kit2")).toMatchObject({ net: 307.82, gross: 349.8, units: 2 });
    expect(lineTotals(174.9, 1, "kit3")).toMatchObject({ net: 446, gross: 524.7, units: 3 });
  });
  it("frete grátis considera o valor antes do desconto do kit, mesmo que o total fique abaixo de 150", () => {
    const t = lineTotals(84.9, 1, "kit2"); // 169,80 antes do desconto, 149,42 depois
    expect(t.net).toBeLessThan(150);
    expect(checkoutTotals([{ gross: t.gross, net: t.net, offer: "kit2" }], "pix").freeShipping).toBe(true);
  });
  it("complemento consumidor: Sérum Argan 84,90 → 80,66 (economia 4,24)", () => {
    const t = lineTotals(84.9, 1, "comp5");
    expect(t.net).toBe(80.66);
    expect(Math.round((t.gross - t.net) * 100) / 100).toBe(4.24);
  });
  it("linha normal não tem desconto", () => {
    expect(lineTotals(154.9, 2)).toMatchObject({ net: 309.8, gross: 309.8, units: 2 });
  });
});

describe("checkout", () => {
  const line = (gross: number, net = gross, offer?: "comp5" | "kit2" | "kit3") => ({ gross, net, offer });
  it("Banana e Mel no Pix: 147,16 COM frete grátis (base antes do desconto)", () => {
    expect(checkoutTotals([line(154.9)], "pix")).toMatchObject({ net: 147.16, pixDiscount: 7.74, freeShipping: true });
  });
  it("Banana e Mel no cartão: 154,90 com frete grátis", () => {
    expect(checkoutTotals([line(154.9)], "card")).toMatchObject({ net: 154.9, freeShipping: true });
  });
  it("cupom de 10%: 139,41 e mantém o frete grátis", () => {
    expect(checkoutTotals([line(154.9)], "card", 0.1)).toMatchObject({ net: 139.41, couponDiscount: 15.49, freeShipping: true });
  });
  it("frete grátis some se a base cair para 150 ou menos", () => {
    expect(checkoutTotals([line(150)], "pix").freeShipping).toBe(false);
    expect(checkoutTotals([line(150.01)], "pix").freeShipping).toBe(true);
  });
  it("pedido misto: 2 Banana e Mel + 1 Café Verde = 424,70 no cartão; Sérum com 5% soma 80,66 → 505,36", () => {
    const lines = [line(309.8), line(114.9), line(84.9, 80.66, "comp5")];
    expect(checkoutTotals(lines, "card")).toMatchObject({ gross: 509.6, net: 505.36, offerDiscount: 4.24 });
  });
  it("Pix NUNCA incide sobre linha com oferta: só nos itens normais", () => {
    const lines = [line(309.8), line(114.9), line(84.9, 80.66, "comp5")];
    const t = checkoutTotals(lines, "pix");
    // 5% apenas sobre 424,70 = 21,24 (403,47) + 80,66 = 484,13
    expect(t.pixDiscount).toBe(21.23);
    expect(t.net).toBe(484.13);
  });
  it("kit profissional não recebe Pix nem cupom por cima", () => {
    const lines = [line(349.8, 307.82, "kit2")];
    expect(checkoutTotals(lines, "pix", 0.1)).toMatchObject({ net: 307.82, pixDiscount: 0, couponDiscount: 0 });
  });
  it("cupom não duplica redução de linha promocional, mas vale nos demais itens", () => {
    const lines = [line(100), line(349.8, 307.82, "kit2")];
    const t = checkoutTotals(lines, "card", 0.1);
    expect(t.couponDiscount).toBe(10);
    expect(t.net).toBe(397.82);
  });
});

describe("classificação e complementos", () => {
  it("progressivas e linha Fio de Luz são somente de salão", () => {
    expect(isProOnly("progressiva-fio-de-luz")).toBe(true);
    expect(isProOnly("shampoo-fio-de-luz-anti-residuo")).toBe(true);
    expect(isProOnly("kit-banana-e-mel")).toBe(false);
  });
  it("progressiva Fio de Luz sugere o shampoo anti-resíduo de preparo", () => {
    const s = complementsFor(["progressiva-fio-de-luz"]);
    expect(s[0]?.slug).toBe("shampoo-fio-de-luz-anti-residuo");
  });
  it("kits de casa sugerem Sérum Argan / Defrizante / Perfume Capilar", () => {
    const s = complementsFor(["kit-banana-e-mel", "kit-cafe-verde"]).map((p) => p.slug);
    expect(s).toEqual(["serum-argan", "defrizante", "perfume-capilar-vonix"]);
  });
  it("nunca sugere o que já está no carrinho nem kits", () => {
    const s = complementsFor(["kit-banana-e-mel", "serum-argan"]).map((p) => p.slug);
    expect(s).not.toContain("serum-argan");
    expect(s).not.toContain("kit-banana-e-mel");
    expect(s.every((slug) => getProduct(slug)!.category !== "kits")).toBe(true);
  });
});
