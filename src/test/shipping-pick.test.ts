import { describe, expect, it } from "vitest";
import { pickTwoShipping } from "@/lib/shipping-pick";

const q = (id: number, price: number, days: number) => ({ id, price, days });

describe("pickTwoShipping", () => {
  it("mantém só a mais rápida e a mais barata", () => {
    const r = pickTwoShipping([q(1, 30, 2), q(2, 18, 5), q(3, 22, 4), q(4, 40, 6)]);
    expect(r.map((x) => x.id)).toEqual([1, 2]);
  });

  it("escolhe a econômica entre as que chegam em até 5 dias", () => {
    const r = pickTwoShipping([q(1, 35, 2), q(2, 15, 9), q(3, 20, 5)]);
    expect(r.map((x) => x.id)).toEqual([1, 3]);
  });

  it("desempata a mais rápida pelo menor preço", () => {
    const r = pickTwoShipping([q(1, 32, 2), q(2, 28, 2), q(3, 19, 5)]);
    expect(r.map((x) => x.id)).toEqual([2, 3]);
  });

  it("devolve uma só quando não há alternativa melhor", () => {
    expect(pickTwoShipping([q(1, 25, 3)]).map((x) => x.id)).toEqual([1]);
    expect(pickTwoShipping([q(1, 20, 2), q(2, 25, 5)]).map((x) => x.id)).toEqual([1]);
  });

  it("não inventa prazo: usa os dias reais da cotação", () => {
    const r = pickTwoShipping([q(1, 30, 4), q(2, 18, 8)]);
    expect(r.map((x) => x.days)).toEqual([4, 8]);
  });
});
