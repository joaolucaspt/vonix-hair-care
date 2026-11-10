import { afterEach, describe, expect, it } from "vitest";
import {
  PENDING_PURCHASE_BASKET_KEY,
  clearPurchaseBasket,
  matchesPurchaseBasket,
  restorePurchaseBasket,
  savePurchaseBasket,
} from "@/lib/pending-purchase-basket";

const a = { slug: "kit-banana-e-mel", variant: "Kit", qty: 1 };
const b = { slug: "queratina-em-gel", variant: "300ml", qty: 2 };
afterEach(() => sessionStorage.clear());

describe("identidade da sacola na confirmação tardia de pagamento", () => {
  it("só permite limpeza quando pedido, variante, oferta e quantidades ainda correspondem", () => {
    savePurchaseBasket(123, [a, b], 1000);
    const restored = restorePurchaseBasket(123, 1500);
    expect(restored).toEqual([a, b]);
    expect(matchesPurchaseBasket([b, a], restored)).toBe(true);
    expect(matchesPurchaseBasket([a], restored)).toBe(false);
    expect(matchesPurchaseBasket([{ ...a, qty: 2 }, b], restored)).toBe(false);
    expect(matchesPurchaseBasket([a, { ...b, variant: "1L" }], restored)).toBe(false);
    expect(matchesPurchaseBasket([a, { ...b, offer: "comp5" }], restored)).toBe(false);
    expect(matchesPurchaseBasket([], restored)).toBe(false);
    expect(matchesPurchaseBasket([a, b], null)).toBe(false);
  });

  it("não apaga recorde de outro pedido e não confunde ordem antiga", () => {
    savePurchaseBasket(123, [a], 5000);
    expect(restorePurchaseBasket(124, 6000)).toBeNull();
    clearPurchaseBasket(124);
    expect(restorePurchaseBasket(123, 6000)).toEqual([a]);
    clearPurchaseBasket(123);
    expect(restorePurchaseBasket(123, 6000)).toBeNull();
  });

  it("expira após 24 horas e rejeita conteúdo adulterado ou descomunal", () => {
    savePurchaseBasket(123, [a], 5000);
    expect(restorePurchaseBasket(123, 5000 + 86400000)).toBeNull();
    expect(restorePurchaseBasket(123, 4999)).toBeNull();
    for (const bad of [
      "not-json",
      JSON.stringify({ orderId: 123, savedAt: 1, lines: [{ ...a, qty: 0 }] }),
      JSON.stringify({ orderId: 123, savedAt: 1, lines: [{ ...a, qty: 99999 }] }),
      JSON.stringify({ orderId: 123, savedAt: 1, lines: [{ ...a, slug: "x".repeat(500) }] }),
      JSON.stringify({ orderId: 123, savedAt: 1, lines: Array(150).fill(a) }),
    ]) {
      sessionStorage.setItem(PENDING_PURCHASE_BASKET_KEY, bad);
      expect(restorePurchaseBasket(123, 2000)).toBeNull();
    }
    expect(matchesPurchaseBasket([a], null)).toBe(false);
  });

  it("não armazena dados pessoais, cartão, valores ou tokens de aprovação", () => {
    savePurchaseBasket(345, [a], 1500);
    const raw = sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY)!;
    expect(JSON.parse(raw)).toEqual({ orderId: 345, lines: [a], savedAt: 1500 });
    expect(raw).not.toMatch(/customer|cpf|phone|email|token|paid|status|total/);
  });

  it("recusa identificadores inválidos e sacolas vazias, nunca autoriza um pagamento", () => {
    savePurchaseBasket(-1, [a]);
    savePurchaseBasket(123, []);
    expect(sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY)).toBeNull();
    expect(restorePurchaseBasket(123)).toBeNull();
  });
});
