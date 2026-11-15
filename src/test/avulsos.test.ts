import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillersForFreeShipping, getProduct, missingForFreeShipping, products } from "@/lib/store";

const avulsos = products.filter((p) => p.category === "avulsos");

describe("unidades avulsas dos kits", () => {
  it("existem, têm foto leve e preço terminado em ,90", () => {
    expect(avulsos.length).toBe(29);
    for (const p of avulsos) {
      for (const img of p.images) {
        const base = "public" + img.replace(/\.jpg$/, "");
        expect(existsSync(base + ".jpg"), p.slug).toBe(true);
        expect(existsSync(base + ".webp"), p.slug).toBe(true);
        expect(existsSync(base + "-480.webp"), p.slug).toBe(true);
      }
      for (const v of p.variants) expect(Math.round((v.price % 1) * 100), `${p.slug} ${v.label}`).toBe(90);
    }
  });

  it("preço da unidade = preço do kit ÷ nº de itens (arredondado em ,90), nunca abaixo do piso de margem", () => {
    const kit = (s: string, label: string) => getProduct(s)!.variants.find((v) => v.label === label)!.price;
    const near = (price: number, target: number) => expect(Math.abs(price - target)).toBeLessThan(1);
    near(getProduct("shampoo-banana-e-mel")!.variants[0]!.price, kit("kit-banana-e-mel", "Kit") / 4);
    near(getProduct("shampoo-cachos")!.variants.find((v) => v.label === "1L")!.price, kit("kit-cachos", "1L") / 3);
    near(getProduct("shampoo-kera-plus")!.variants[0]!.price, kit("kit-cauterizacao", "500ml") / 4);
    near(getProduct("mascara-desmaia-cabelo-300g")!.variants[0]!.price, kit("kit-desmaia", "300ml") / 2);
    near(getProduct("mascara-monovonix")!.variants.find((v) => v.label === "500ml")!.price, kit("kit-monovonix", "500ml") / 2);
  });

  it("sugere avulsos só enquanto falta para o frete grátis, sem repetir o que já está no carrinho", () => {
    expect(fillersForFreeShipping([], 151)).toEqual([]);
    const list = fillersForFreeShipping(["shampoo-banana-e-mel"], 100);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(3);
    for (const f of list) {
      expect(f.product.category).toBe("avulsos");
      expect(f.product.slug).not.toBe("shampoo-banana-e-mel");
    }
    const missing = missingForFreeShipping(100);
    // quando algum avulso sozinho completa o que falta, ele vem primeiro
    expect(list[0]!.variant.price).toBeGreaterThanOrEqual(Math.min(missing, ...avulsos.flatMap((p) => p.variants.map((v) => v.price)).filter((x) => x >= missing)));
  });
});

describe("vitrine na ordem do curso (mais vendidos primeiro)", () => {
  it("cada avulso aponta para um kit que existe e os kits listam suas unidades", async () => {
    const { kitItems } = await import("@/lib/store");
    for (const p of avulsos) {
      expect(p.kit, p.slug).toBeTruthy();
      expect(getProduct(p.kit!)?.category, p.slug).toBe("kits");
    }
    expect(kitItems("kit-banana-e-mel").map((p) => p.slug)).toEqual(["shampoo-banana-e-mel", "condicionador-banana-e-mel", "mascara-banana-e-mel", "leave-in-banana-e-mel"]);
  });

  it("'mais desejados' da home: sem avulsos, o que mais vende vem antes e, em casa, química por último", async () => {
    const { homeBestSellers, bySales } = await import("@/lib/store");
    const casa = homeBestSellers("casa");
    expect(casa.length).toBe(8);
    expect(casa.every((p) => p.category !== "avulsos")).toBe(true);
    expect(casa[0]!.slug).toBe("kit-banana-e-mel");
    const kits = bySales(products.filter((p) => p.category === "kits")).map((p) => p.slug);
    expect(kits[0]).toBe("kit-banana-e-mel");
    expect(kits[1]).toBe("kit-cronograma-capilar");
  });
});
