import { describe, expect, it } from "vitest";
import { getProduct, products } from "@/lib/store";
import { pickExtras } from "@/lib/upsell";

describe("sugestões de compra adicionais", () => {
  it("não sugere produtos excluídos ou já adicionados e nunca repete sugestões", () => {
    const cartSlugs = ["kit-banana-e-mel", "serum-argan"];
    const extras = pickExtras(cartSlugs, 3, () => 0.4);
    expect(extras.length).toBeLessThanOrEqual(3);
    expect(new Set(extras.map((p) => p.slug)).size).toBe(extras.length);
    expect(extras.every((p) => products.some((stock) => stock.slug === p.slug))).toBe(true);
    expect(extras.every((p) => !cartSlugs.includes(p.slug))).toBe(true);
    expect(extras.map((p) => p.slug)).not.toContain("plex-vonix");
  });

  it("prioriza o shampoo correspondente quando a progressiva pede esse complemento", () => {
    expect(getProduct("progressiva-fio-de-luz")).toBeDefined();
    expect(getProduct("shampoo-fio-de-luz-anti-residuo")).toBeDefined();
    const extras = pickExtras(["progressiva-fio-de-luz"], 3, () => 0.3);
    expect(extras[0]?.slug).toBe("shampoo-fio-de-luz-anti-residuo");
  });

  it("não repete o shampoo de tratamento quando ele já está no carrinho", () => {
    const cart = ["progressiva-fio-de-luz", "shampoo-fio-de-luz-anti-residuo"];
    expect(pickExtras(cart, 3, () => 0.2).map((p) => p.slug)).not.toContain(cart[1]);
  });
});
