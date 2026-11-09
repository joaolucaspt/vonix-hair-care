import { describe, expect, it } from "vitest";
import { COUPONS, SIGNUP_COUPON, WHEEL, couponCheck, couponFreeShipping, couponPercent, findCoupon } from "@/lib/coupons";
import { checkoutTotals } from "@/lib/store";

describe("cupons e roleta", () => {
  it("a roleta sorteia só cupons que existem e as chances somam 100%", () => {
    expect(WHEEL.reduce((s, w) => s + w.weight, 0)).toBe(100);
    for (const w of WHEEL) expect(findCoupon(w.code)).toBeDefined();
  });
  it("copy de desconto explica que cupons não acumulam com ofertas de quantidade", () => {
    for (const c of COUPONS) expect(c.label).toContain("itens sem outra oferta");
  });
  it("código é aceito sem diferenciar maiúsculas e espaços; desconhecido não vale", () => {
    expect(findCoupon(" gira5 ")?.code).toBe("GIRA5");
    expect(findCoupon("QUALQUER")).toBeUndefined();
    expect(couponPercent(findCoupon("bt10"), 20)).toBe(0.1);
    expect(WHEEL.some((w) => w.code === "BT10")).toBe(false);
    expect(findCoupon("")).toBeUndefined();
  });
  it("cupom de boas-vindas do cadastro: 5% em qualquer compra, só digitado ou entregue pelo cadastro, nunca na roleta", () => {
    const c = findCoupon(SIGNUP_COUPON)!;
    expect(c.code).toBe("BEMVINDA5");
    expect(c.percent).toBe(5);
    expect(c.minSubtotal).toBeUndefined();
    expect(couponPercent(c, 10)).toBe(0.05);
    expect(couponPercent(c, 1000)).toBe(0.05);
    expect(WHEEL.some((w) => w.code === SIGNUP_COUPON)).toBe(false);
    // em 1 unidade (sem oferta), com Pix: cupom 5% e depois Pix 5%
    const t = checkoutTotals([{ gross: 100, net: 100 }], "pix", 0.05);
    expect(t.couponDiscount).toBe(5);
    expect(t.net).toBe(90.25);
  });
  it("valor mínimo é medido antes dos descontos", () => {
    const c = findCoupon("GIRA6")!;
    expect(couponCheck(c, 249.99).ok).toBe(false);
    expect(couponCheck(c, 250).ok).toBe(true);
    expect(couponPercent(c, 100)).toBe(0);
    expect(couponPercent(c, 300)).toBe(0.06);
  });
  it("cupom sem mínimo vale em qualquer compra e todos os cupons da roleta são só desconto", () => {
    expect(couponPercent(findCoupon("GIRA3"), 20)).toBe(0.03);
    expect(COUPONS.every((c) => !c.freeShipping)).toBe(true);
    expect(couponFreeShipping(findCoupon("GIRA5"), 500)).toBe(false);
  });
  it("cupom soma com o Pix, mas não incide sobre itens com oferta (Leve 2 / Leve 3)", () => {
    const normal = { gross: 200, net: 200 };
    const kit = { gross: 349.8, net: 307.82, offer: "kit2" as const };
    expect(checkoutTotals([normal], "pix", 0.1)).toMatchObject({ couponDiscount: 20, pixDiscount: 9, net: 171 });
    expect(checkoutTotals([kit], "pix", 0.1)).toMatchObject({ couponDiscount: 0, pixDiscount: 0, net: 307.82 });
  });
});
