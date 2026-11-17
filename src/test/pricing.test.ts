import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { USAGE, cardPricing, forAudience, resolveAudience, checkoutTotals, complementsFor, getProduct, hasFreeShipping, installments, isProOnly, lineHasOffer, lineTotals, migrateCart, pixPrice, products, volumePct } from "@/lib/store";

// O teste de preços (13/11 a 20/11/2026) lê a data na hora: fixamos "hoje" dentro do prazo para os números ficarem estáveis.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T12:00:00-03:00"));
});
afterAll(() => vi.useRealTimers());

describe("ambiente e preços dos cards", () => {
  it("links sem uso ou com uso legado não limpam o ambiente escolhido", () => {
    expect(resolveAudience("casa")).toBe("casa");
    expect(resolveAudience("casa", "pessoal")).toBe("casa");
    expect(resolveAudience("salao")).toBe("salao");
    expect(resolveAudience(null)).toBe(null);
  });
  it("Fio de Luz no salão: preço novo, Pix com 5% de desconto e promoção de kits", () => {
    const p = getProduct("progressiva-fio-de-luz");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({ professional: true, price: 131.9, pix: 125.31, parcels: { count: 6, value: 21.98, first: 22 } });
    expect(cardPricing(p, "casa").price).toBe(131.9);
  });
  it("kits prontos também têm a promoção de levar 2 ou 3, e o Pix com 5%, no salão e em casa", () => {
    const p = getProduct("kit-banana-e-mel");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({ professional: true, price: 122.9, pix: 116.76 });
    expect(cardPricing(p, "casa")).toMatchObject({ professional: true, price: 122.9, pix: 116.76 });
  });
  it("todo produto do site tem a promoção de levar mais de um, em qualquer área", () => {
    for (const a of ["casa", "salao", null] as const)
      for (const p of products) expect(cardPricing(p, a).professional).toBe(true);
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
  it("catálogo tem 74 produtos (42 + 29 avulsos + 4 perfumes separados − perfume antigo; Plex Vonix sem estoque)", () => expect(products.length).toBe(74));
  it("com o teste encerrado (14/11) valem os preços de products.json", () => {
    expect(getProduct("progressiva-fio-de-luz")!.variants[0]?.price).toBe(131.9);
    expect(getProduct("kit-cachos")!.variants.map((v) => v.price)).toEqual([59.9, 143.9]);
  });
  it("depois da data, os preços seguem os de products.json (teste encerrado)", () => {
    vi.setSystemTime(new Date("2026-11-21T00:00:01-03:00"));
    expect(getProduct("progressiva-fio-de-luz")!.variants[0]?.price).toBe(131.9);
    expect(getProduct("kit-cachos")!.variants.map((v) => v.price)).toEqual([59.9, 143.9]);
    vi.setSystemTime(new Date("2026-11-14T12:00:00-03:00"));
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
  it("Pix com 5% de desconto sobre o preço do cartão", () => expect(pixPrice(174.9)).toBe(166.16));
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
  it("1 unidade não tem desconto", () => {
    expect(lineTotals(154.9, 1)).toMatchObject({ net: 154.9, gross: 154.9, units: 1 });
  });
});

describe("desconto por quantidade (segue a quantidade, em qualquer lugar)", () => {
  it("2 unidades = 12% OFF e 3 ou mais = 15% OFF, sem precisar escolher a promoção", () => {
    expect(volumePct(1)).toBe(0);
    expect(volumePct(2)).toBe(12);
    expect(volumePct(3)).toBe(15);
    expect(volumePct(10)).toBe(15);
    expect(lineTotals(154.9, 2)).toMatchObject({ gross: 309.8, net: 272.62, units: 2 });
    expect(lineTotals(154.9, 3)).toMatchObject({ gross: 464.7, net: 395, units: 3 });
    expect(lineTotals(174.9, 4)).toMatchObject({ gross: 699.6, net: 594.66, units: 4 });
  });
  it("dá exatamente o mesmo valor do combo antigo (Leve 2 e Leve 3)", () => {
    for (const price of [174.9, 154.9, 84.9, 49.9]) {
      expect(lineTotals(price, 2).net).toBe(lineTotals(price, 1, "kit2").net);
      expect(lineTotals(price, 3).net).toBe(lineTotals(price, 1, "kit3").net);
    }
  });
  it("a quantidade muda no carrinho: o desconto aparece e some junto, nunca fica preso", () => {
    const net = (q: number) => lineTotals(164.9, q).net;
    expect(net(1)).toBe(164.9);
    expect(net(2)).toBeLessThan(net(1) * 2);
    expect(net(3)).toBeLessThan(net(2) + net(1));
    expect(net(2) / 2).toBeGreaterThan(net(3) / 3);
    expect(net(1)).toBe(164.9);
  });
  it("linha com desconto por quantidade não recebe cupom por cima, e o Pix não tem desconto", () => {
    const one = lineTotals(100, 1);
    const two = lineTotals(100, 2);
    const t = checkoutTotals([{ gross: one.gross, net: one.net }, { gross: two.gross, net: two.net }], "pix", 0.1);
    expect(t.hasOffers).toBe(true);
    expect(t.couponDiscount).toBe(10); // 10% só sobre a linha de 1 unidade
    expect(t.pixDiscount).toBe(0); // Pix sem desconto
    expect(t.offerDiscount).toBe(24); // 12% de 200
    expect(t.net).toBe(100 - 10 + 176);
    expect(lineHasOffer({ gross: 100, net: 100 })).toBe(false);
    expect(lineHasOffer({ gross: 200, net: 176 })).toBe(true);
  });
  it("carrinho antigo (combo de 2 ou 3) vira unidades e o desconto é recalculado pelo total", () => {
    const old = [
      { slug: "botox-vonix", variant: "1Kg", qty: 1, offer: "kit2" as const },
      { slug: "botox-vonix", variant: "1Kg", qty: 1 },
      { slug: "mascara-whey-protein", variant: "1Kg", qty: 2, offer: "kit3" as const },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const },
    ];
    const out = migrateCart(old);
    expect(out).toEqual([
      { slug: "botox-vonix", variant: "1Kg", qty: 3 },
      { slug: "mascara-whey-protein", variant: "1Kg", qty: 6 },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" },
    ]);
  });
});

describe("checkout", () => {
  const line = (gross: number, net = gross, offer?: "comp5" | "kit2" | "kit3") => ({ gross, net, offer });
  it("Banana e Mel no Pix: 147,16 (5% off) COM frete grátis", () => {
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
  it("Pix tem 5% só nas linhas sem oferta de quantidade", () => {
    const lines = [line(309.8), line(114.9), line(84.9, 80.66, "comp5")];
    const t = checkoutTotals(lines, "pix");
    expect(t.pixDiscount).toBe(21.23);
    expect(t.net).toBe(484.13);
  });
  it("Pix com 5% não soma com cupom: com cupom aplicado o desconto do Pix some", () => {
    const t = checkoutTotals([line(100)], "pix", 0.1);
    expect(t).toMatchObject({ couponDiscount: 10, pixDiscount: 0, net: 90 });
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
    expect(s).toEqual(["serum-argan", "defrizante", "perfume-capilar-vonix-rubi"]);
  });
  it("nunca sugere o que já está no carrinho nem kits", () => {
    const s = complementsFor(["kit-banana-e-mel", "serum-argan"]).map((p) => p.slug);
    expect(s).not.toContain("serum-argan");
    expect(s).not.toContain("kit-banana-e-mel");
    expect(s.every((slug) => getProduct(slug)!.category !== "kits")).toBe(true);
  });
});
