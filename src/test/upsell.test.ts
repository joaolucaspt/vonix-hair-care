import { describe, expect, it } from "vitest";
import { upsellPlan } from "@/lib/upsell";

const slugs = (cart: string[]) => upsellPlan(cart).items.map((i) => i.product.slug);

describe("upsellPlan (leve também, personalizado pelo carrinho)", () => {
  it("progressiva Fio de Luz: anti-resíduo dela primeiro, depois hidratante, finalizador e perfume", () => {
    const r = slugs(["progressiva-fio-de-luz"]);
    expect(r[0]).toBe("shampoo-fio-de-luz-anti-residuo");
    expect(r).toContain("mascara-efeito-teia-coco-nutri");
    expect(r).toContain("defrizante");
    expect(r).toContain("perfume-capilar-vonix-rubi");
    expect(r).toHaveLength(4);
  });
  it("progressiva Diamond sugere o anti-resíduo Diamond; botox também recebe o combo completo", () => {
    expect(slugs(["progressiva-diamond"])[0]).toBe("shampoo-diamond-anti-residuo");
    expect(slugs(["botox-vonix"])[0]).toBe("shampoo-fio-de-luz-anti-residuo");
    expect(slugs(["botox-line-matizador"])).toContain("perfume-capilar-vonix-rubi");
  });
  it("nunca repete o que já está no carrinho e os 4 itens são distintos", () => {
    const r = slugs(["progressiva-fio-de-luz", "shampoo-fio-de-luz-anti-residuo", "defrizante"]);
    expect(new Set(r).size).toBe(r.length);
    for (const s of ["progressiva-fio-de-luz", "shampoo-fio-de-luz-anti-residuo", "defrizante"]) expect(r).not.toContain(s);
    expect(r.length).toBeGreaterThanOrEqual(3);
  });
  it("é sempre o mesmo para o mesmo carrinho (sem sorteio)", () => {
    expect(slugs(["kit-banana-e-mel"])).toEqual(slugs(["kit-banana-e-mel"]));
  });
  it("kit sugere finalizador e perfume; unidade avulsa sugere o resto da mesma linha e o kit", () => {
    expect(slugs(["kit-banana-e-mel"])).toEqual(expect.arrayContaining(["serum-argan", "perfume-capilar-vonix-rubi"]));
    const r = upsellPlan(["shampoo-banana-e-mel"]);
    expect(r.title).toBe("Complete o ritual");
    expect(r.items.map((i) => i.product.slug)).toEqual(expect.arrayContaining(["mascara-banana-e-mel", "leave-in-banana-e-mel"]));
  });
  it("perfume sugere as outras cores", () => {
    const r = slugs(["perfume-capilar-vonix-rubi"]);
    expect(r).toEqual(expect.arrayContaining(["perfume-capilar-vonix-ouro", "perfume-capilar-vonix-azul", "perfume-capilar-vonix-verde"]));
  });
  it("todo item traz um motivo escrito e não inventa dados de quem comprou junto", () => {
    for (const cart of [["progressiva-fio-de-luz"], ["kit-cachos"], ["serum-argan"]]) {
      for (const i of upsellPlan(cart).items) {
        expect(i.reason.length).toBeGreaterThan(20);
        expect(i.reason.toLowerCase()).not.toContain("quem levou");
      }
    }
  });
});
