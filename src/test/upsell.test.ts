import { describe, expect, it } from "vitest";
import { pickExtras } from "@/lib/upsell";

describe("pickExtras (leve também)", () => {
  it("progressiva Fio de Luz sempre sugere o shampoo anti-resíduo dela primeiro", () => {
    for (let i = 0; i < 20; i++) expect(pickExtras(["progressiva-fio-de-luz"])[0]?.slug).toBe("shampoo-fio-de-luz-anti-residuo");
  });
  it("progressiva Diamond sugere o anti-resíduo Diamond", () => {
    expect(pickExtras(["progressiva-diamond"])[0]?.slug).toBe("shampoo-diamond-anti-residuo");
  });
  it("não sugere o que já está no carrinho e entrega 3 itens distintos", () => {
    const r = pickExtras(["progressiva-fio-de-luz", "shampoo-fio-de-luz-anti-residuo"]);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((p) => p.slug)).size).toBe(3);
    expect(r.some((p) => p.slug === "shampoo-fio-de-luz-anti-residuo" || p.slug === "progressiva-fio-de-luz")).toBe(false);
  });
  it("varia entre aberturas", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) pickExtras(["kit-cachos"]).forEach((p) => seen.add(p.slug));
    expect(seen.size).toBeGreaterThan(3);
  });
});
