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

import { pickFreeShipping } from "@/lib/shipping-pick";

describe("pickFreeShipping", () => {
  it("escolhe a mais barata, mesmo que demore mais, quando a rápida custa bem mais", () => {
    expect(pickFreeShipping([q(1, 15, 6), q(2, 28, 3), q(3, 39, 2)])?.id).toBe(1);
  });
  it("cotações reais de Salvador (12/11/2026): JeT R$ 17,13 em 4 dias vence o SEDEX de R$ 52,87", () => {
    const r = pickFreeShipping([q(1, 52.87, 2), q(2, 17.13, 4)]);
    expect(r?.id).toBe(2);
    expect(r?.days).toBe(4);
  });
  it("prefere a rápida (até 3 dias) quando custa no máximo R$ 8 a mais", () => {
    expect(pickFreeShipping([q(1, 14.1, 3), q(2, 15.28, 2)])?.id).toBe(1);
    expect(pickFreeShipping([q(1, 15, 6), q(2, 22, 3)])?.id).toBe(2);
    expect(pickFreeShipping([q(1, 15, 6), q(2, 23.01, 3)])?.id).toBe(1);
  });
  it("sem opção rápida, usa a mais barata com o prazo real", () => {
    const r = pickFreeShipping([q(1, 15, 6), q(2, 28, 4)]);
    expect(r?.id).toBe(1);
    expect(r?.days).toBe(6);
  });
  it("lista vazia não escolhe nada", () => {
    expect(pickFreeShipping([])).toBeUndefined();
  });
});
