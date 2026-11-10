import { describe, expect, it } from "vitest";
import {
  USAGE,
  cardPricing,
  forAudience,
  resolveAudience,
  checkoutTotals,
  complementsFor,
  getProduct,
  hasFreeShipping,
  installments,
  isProOnly,
  lineHasOffer,
  lineTotals,
  migrateCart,
  pixPrice,
  products,
  volumePct,
} from "@/lib/store";

describe("ambiente e preços dos cards", () => {
  it("troca o desconto de complemento pelo desconto maior de volume com 2 ou 3 unidades", () => {
    const base = getProduct("kit-banana-e-mel")!;
    const complement = getProduct("serum-argan")!;
    const variant = complement.variants[0]!;
    for (const qty of [2, 3]) {
      const cart = migrateCart([
        { slug: base.slug, variant: base.variants[0].label, qty: 1 },
        { slug: complement.slug, variant: variant.label, qty, offer: "comp5" },
      ]);
      const line = cart.find((item) => item.slug === complement.slug);
      expect(line).toEqual({ slug: complement.slug, variant: variant.label, qty });
      expect(lineTotals(variant.price, qty, "comp5").net).toBe(lineTotals(variant.price, qty).net);
    }
  });

  it("mantém o desconto maior por volume nas 46 variantes mesmo com oferta legada de complemento", () => {
    let checked = 0;
    let improved = 0;
    for (const product of products) {
      for (const variant of product.variants) {
        for (const qty of [2, 3, 4, 99]) {
          const volume = lineTotals(variant.price, qty);
          const legacyComplement = lineTotals(variant.price, qty, "comp5");
          expect(legacyComplement).toEqual(volume);
          if (legacyComplement.net < variant.price * qty * 0.95 - 0.01) improved++;
          checked++;
        }
      }
    }
    expect(checked).toBe(184);
    expect(improved).toBeGreaterThan(0);
  });

  it("reúne dois complementos individuais e passa à promoção maior de duas unidades", () => {
    const base = getProduct("kit-banana-e-mel")!;
    const complement = getProduct("serum-argan")!;
    const variant = complement.variants[0]!;
    const cart = migrateCart([
      { slug: base.slug, variant: base.variants[0].label, qty: 1 },
      { slug: complement.slug, variant: variant.label, qty: 1, offer: "comp5" },
      { slug: complement.slug, variant: variant.label, qty: 1, offer: "comp5" },
    ]);
    const line = cart.find((item) => item.slug === complement.slug);
    expect(line).toEqual({ slug: complement.slug, variant: variant.label, qty: 2 });
    expect(lineTotals(variant.price, line!.qty, line!.offer).net).toBe(
      lineTotals(variant.price, 2).net,
    );
  });

  it("junta unidades do mesmo SKU mesmo quando uma entrou pela oferta complementar", () => {
    const base = getProduct("kit-banana-e-mel")!;
    const complement = getProduct("serum-argan")!;
    const variant = complement.variants[0]!;
    const cart = migrateCart([
      { slug: base.slug, variant: base.variants[0].label, qty: 1 },
      { slug: complement.slug, variant: variant.label, qty: 1, offer: "comp5" },
      { slug: complement.slug, variant: variant.label, qty: 1 },
    ]);
    expect(
      cart.filter((item) => item.slug === complement.slug && item.variant === variant.label),
    ).toEqual([{ slug: complement.slug, variant: variant.label, qty: 2 }]);
  });

  it("links sem uso ou com uso legado não limpam o ambiente escolhido", () => {
    expect(resolveAudience("casa")).toBe("casa");
    expect(resolveAudience("casa", "pessoal")).toBe("casa");
    expect(resolveAudience("casa", "salao")).toBe("salao");
    expect(resolveAudience("salao", "casa")).toBe("casa");
    expect(resolveAudience("salao")).toBe("salao");
    expect(resolveAudience(null)).toBe(null);
  });
  it("Fio de Luz no salão não tem 5% profissional: preço de catálogo, Pix normal e promoção de kits", () => {
    const p = getProduct("progressiva-fio-de-luz");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({
      professional: true,
      price: 191.9,
      pix: 182.31,
      parcels: { count: 6, value: 31.98, first: 32 },
    });
    expect(cardPricing(p, "casa").price).toBe(191.9);
  });
  it("kits prontos também têm a promoção de levar 2 ou 3, sem 5% extra, no salão e em casa", () => {
    const p = getProduct("kit-banana-e-mel");
    if (!p) throw new Error("Produto obrigatório ausente");
    expect(cardPricing(p, "salao")).toMatchObject({
      professional: true,
      price: 169.9,
      pix: 161.41,
    });
    expect(cardPricing(p, "casa")).toMatchObject({ professional: true, price: 169.9, pix: 161.41 });
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
    expect(lastSlugs.some((s) => s.startsWith("progressiva-") || s.startsWith("botox-"))).toBe(
      true,
    );
    expect(l.findIndex((p) => p.slug === "progressiva-fio-de-luz")).toBeGreaterThan(
      l.findIndex((p) => p.slug === "kit-cafe-verde"),
    );
  });
  it("área de salão: profissionais primeiro e produtos de casa embaixo", () => {
    const l = forAudience(products, "salao");
    expect(l[0]?.slug).toBe("progressiva-fio-de-luz");
    const firstHome = l.findIndex((p) => !USAGE["salao"]?.(p));
    expect(l.slice(firstHome).every((p) => !USAGE["salao"]?.(p))).toBe(true);
  });
});

describe("regras comerciais", () => {
  it("catálogo tem 42 produtos (Plex Vonix sem estoque)", () => expect(products.length).toBe(42));
  it("preço já inclui +15 uma vez", () => {
    expect(getProduct("progressiva-fio-de-luz")!.variants[0]?.price).toBe(191.9);
    expect(getProduct("kit-cachos")!.variants.map((v) => v.price)).toEqual([81.9, 213.9]);
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
  it("a elegibilidade de frete grátis é consistente nas 46 variantes e quantidades 1, 2, 3", () => {
    let checked = 0;
    let grossAboveWithNetBelow = 0;
    for (const product of products) {
      for (const variant of product.variants) {
        for (const qty of [1, 2, 3]) {
          const line = lineTotals(variant.price, qty);
          const totals = checkoutTotals([line], "pix");
          expect(totals.freeShipping, product.slug + " " + variant.label + " ×" + qty).toBe(
            hasFreeShipping(line.gross),
          );
          if (hasFreeShipping(line.gross) && line.net <= 150) grossAboveWithNetBelow += 1;
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(138);
    expect(grossAboveWithNetBelow).toBeGreaterThan(0);
  });

  it("frete grátis considera o valor antes do desconto do kit, mesmo que o total fique abaixo de 150", () => {
    const t = lineTotals(84.9, 1, "kit2"); // 169,80 antes do desconto, 149,42 depois
    expect(t.net).toBeLessThan(150);
    expect(
      checkoutTotals([{ gross: t.gross, net: t.net, offer: "kit2" }], "pix").freeShipping,
    ).toBe(true);
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
  it("linha com desconto por quantidade não recebe Pix 5% nem cupom por cima", () => {
    const one = lineTotals(100, 1);
    const two = lineTotals(100, 2);
    const t = checkoutTotals(
      [
        { gross: one.gross, net: one.net },
        { gross: two.gross, net: two.net },
      ],
      "pix",
      0.1,
    );
    expect(t.hasOffers).toBe(true);
    expect(t.couponDiscount).toBe(10); // 10% só sobre a linha de 1 unidade
    expect(t.pixDiscount).toBe(4.5); // 5% só sobre ela, depois do cupom
    expect(t.offerDiscount).toBe(24); // 12% de 200
    expect(t.net).toBe(100 - 10 - 4.5 + 176);
    expect(lineHasOffer({ gross: 100, net: 100 })).toBe(false);
    expect(lineHasOffer({ gross: 200, net: 176 })).toBe(true);
  });
  it("carrinho antigo (combo de 2 ou 3) vira unidades e o desconto é recalculado pelo total", () => {
    const old = [
      { slug: "botox-vonix", variant: "1Kg", qty: 1, offer: "kit2" as const },
      { slug: "botox-vonix", variant: "1Kg", qty: 1 },
      { slug: "mascara-whey-protein", variant: "2Kg", qty: 2, offer: "kit3" as const },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const },
    ];
    const out = migrateCart(old);
    expect(out).toEqual([
      { slug: "botox-vonix", variant: "1Kg", qty: 3 },
      { slug: "mascara-whey-protein", variant: "2Kg", qty: 6 },
      { slug: "serum-argan", variant: "60ml", qty: 1 },
    ]);
  });
});

describe("revalidação de carrinhos antigos e itens fora de estoque", () => {
  it("remove produto indisponível e entradas inválidas sem apagar outros itens", () => {
    const saved: unknown = [
      { slug: "plex-vonix", variant: "1000ml", qty: 1 },
      { slug: "kit-banana-e-mel", variant: "Kit", qty: 1 },
      null,
      8,
      { slug: "serum-argan", variant: "60ml", qty: -4 },
      { slug: "serum-argan", variant: "60ml", qty: "2" },
      { slug: "serum-argan", variant: "1000ml", qty: 1 },
    ];
    expect(migrateCart(saved)).toEqual([{ slug: "kit-banana-e-mel", variant: "Kit", qty: 1 }]);
    expect(migrateCart(null)).toEqual([]);
    expect(migrateCart({ slug: "plex-vonix" })).toEqual([]);
  });

  it("recalcula desconto quando o único item-base ficou sem estoque", () => {
    const saved = [
      { slug: "plex-vonix", variant: "1000ml", qty: 1 },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const },
    ];
    expect(migrateCart(saved)).toEqual([{ slug: "serum-argan", variant: "60ml", qty: 1 }]);
    const stillEligible = [
      { slug: "kit-banana-e-mel", variant: "Kit", qty: 1 },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const },
    ];
    expect(migrateCart(stillEligible)).toEqual(stillEligible);
    // A standalone bestseller is not a valid "complement" just because it
    // appears among general recommendations for an empty cart.
    expect(migrateCart([{ slug: "botox-vonix", variant: "1Kg", qty: 1, offer: "comp5" }])).toEqual([
      { slug: "botox-vonix", variant: "1Kg", qty: 1 },
    ]);
  });

  it("soma unidades antigas no limite e retira promoção incompatível", () => {
    const saved = [
      { slug: "botox-vonix", variant: "1Kg", qty: 1, offer: "kit3" as const },
      { slug: "botox-vonix", variant: "1Kg", qty: 99 },
      { slug: "serum-argan", variant: "60ml", qty: 1, offer: "comp5" as const },
      { slug: "serum-argan", variant: "60ml", qty: 1 },
    ];
    expect(migrateCart(saved)).toEqual([
      { slug: "botox-vonix", variant: "1Kg", qty: 99 },
      { slug: "serum-argan", variant: "60ml", qty: 2 },
    ]);
  });
});

describe("consistência de informações de produto e entrega", () => {
  it("nenhuma das 42 descrições ativas promete transportadoras excluídas pelo checkout", () => {
    expect(products.length).toBe(42);
    expect(getProduct("plex-vonix")).toBeUndefined();
    for (const p of products) {
      expect(p.description).not.toMatch(/Loggi|Total Express/i);
      expect(p.description).toContain("opções de entrega disponíveis para o seu CEP");
    }
  });
  it("preços, SKU e variantes têm valores monetários seguros em todo o catálogo", () => {
    for (const p of products) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.images.length).toBeGreaterThan(0);
      expect(p.variants.length).toBeGreaterThan(0);
      for (const v of p.variants) {
        expect(Number.isFinite(v.price)).toBe(true);
        expect(v.price).toBeGreaterThan(0);
        expect(Math.round(v.price * 100) / 100).toBe(v.price);
      }
    }
  });
});

describe("checkout", () => {
  const line = (gross: number, net = gross, offer?: "comp5" | "kit2" | "kit3") => ({
    gross,
    net,
    offer,
  });
  it("Banana e Mel no Pix: preço atual do catálogo 169,90 → 161,41, com frete grátis", () => {
    const price = getProduct("kit-banana-e-mel")!.variants[0].price;
    expect(price).toBe(169.9);
    expect(checkoutTotals([line(price)], "pix")).toMatchObject({
      net: 161.41,
      pixDiscount: 8.49,
      freeShipping: true,
    });
  });
  it("Banana e Mel no cartão: 169,90 com frete grátis", () => {
    const price = getProduct("kit-banana-e-mel")!.variants[0].price;
    expect(checkoutTotals([line(price)], "card")).toMatchObject({ net: 169.9, freeShipping: true });
  });
  it("cupom de 10%: 152,91 no preço atual e mantém o frete grátis", () => {
    const price = getProduct("kit-banana-e-mel")!.variants[0].price;
    expect(checkoutTotals([line(price)], "card", 0.1)).toMatchObject({
      net: 152.91,
      couponDiscount: 16.99,
      freeShipping: true,
    });
  });
  it("frete grátis some se a base cair para 150 ou menos", () => {
    expect(checkoutTotals([line(150)], "pix").freeShipping).toBe(false);
    expect(checkoutTotals([line(150.01)], "pix").freeShipping).toBe(true);
  });
  it("pedido misto usa o preço atual de cada produto e aplica o desconto por quantidade", () => {
    const banana = lineTotals(getProduct("kit-banana-e-mel")!.variants[0].price, 2);
    const cafe = lineTotals(getProduct("kit-cafe-verde")!.variants[0].price, 1);
    const serum = lineTotals(getProduct("serum-argan")!.variants[0].price, 1, "comp5");
    const t = checkoutTotals([banana, cafe, { ...serum, offer: "comp5" }], "card");
    expect(banana.gross).toBe(339.8);
    expect(banana.net).toBe(299.02);
    expect(cafe.net).toBe(125.9);
    expect(t.net).toBeCloseTo(banana.net + cafe.net + serum.net, 2);
    expect(t.offerDiscount).toBeGreaterThan(0);
  });
  it("Pix NUNCA incide sobre linhas com oferta ou quantidade promocional", () => {
    const banana = lineTotals(getProduct("kit-banana-e-mel")!.variants[0].price, 2);
    const cafe = lineTotals(getProduct("kit-cafe-verde")!.variants[0].price, 1);
    const serum = lineTotals(getProduct("serum-argan")!.variants[0].price, 1, "comp5");
    const lines = [banana, cafe, { ...serum, offer: "comp5" as const }];
    const t = checkoutTotals(lines, "pix");
    // Só o Café Verde de 1 unidade participa do desconto Pix nesta cesta.
    expect(t.pixDiscount).toBe(6.29);
    expect(t.net).toBeCloseTo(banana.net + cafe.net + serum.net - 6.29, 2);
  });
  it("kit profissional não recebe Pix nem cupom por cima", () => {
    const lines = [line(349.8, 307.82, "kit2")];
    expect(checkoutTotals(lines, "pix", 0.1)).toMatchObject({
      net: 307.82,
      pixDiscount: 0,
      couponDiscount: 0,
    });
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
