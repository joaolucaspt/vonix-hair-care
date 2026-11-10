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

  it("preserva a identidade de dois pedidos diferentes no mesmo navegador, em qualquer ordem de confirmação", () => {
    savePurchaseBasket(123, [a], 5000);
    savePurchaseBasket(124, [b], 5500);
    expect(restorePurchaseBasket(123, 6000)).toEqual([a]);
    expect(restorePurchaseBasket(124, 6000)).toEqual([b]);
    clearPurchaseBasket(124);
    expect(restorePurchaseBasket(124, 6000)).toBeNull();
    expect(restorePurchaseBasket(123, 6000)).toEqual([a]);
    clearPurchaseBasket(123);
    expect(restorePurchaseBasket(123, 6000)).toBeNull();
  });

  it("preserva snapshots legados de antes da migração sem confundir pedidos", () => {
    sessionStorage.setItem(
      PENDING_PURCHASE_BASKET_KEY,
      JSON.stringify({ orderId: 120, lines: [a], savedAt: 4000 }),
    );
    expect(restorePurchaseBasket(120, 4500)).toEqual([a]);
    savePurchaseBasket(121, [b], 4500);
    expect(restorePurchaseBasket(120, 4600)).toEqual([a]);
    expect(restorePurchaseBasket(121, 4600)).toEqual([b]);
    clearPurchaseBasket(121);
    expect(restorePurchaseBasket(120, 4700)).toEqual([a]);
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
    expect(JSON.parse(raw)).toEqual({
      version: 2,
      entries: [{ orderId: 345, lines: [a], savedAt: 1500 }],
    });
    expect(raw).not.toMatch(/customer|cpf|phone|email|token|paid|status|total/);
  });

  it("mantém no máximo oito pedidos da sessão e remove o mais antigo, sem confundir identificadores", () => {
    for (let i = 1; i <= 10; i++) savePurchaseBasket(i, [a], 1000 + i * 100);
    const saved = JSON.parse(sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.entries).toHaveLength(8);
    expect(restorePurchaseBasket(1, 2100)).toBeNull();
    expect(restorePurchaseBasket(2, 2100)).toBeNull();
    for (let i = 3; i <= 10; i++) expect(restorePurchaseBasket(i, 2100)).toEqual([a]);
  });

  it("isola um registro corrompido sem apagar as identidades de outros pedidos", () => {
    savePurchaseBasket(123, [a], 1000);
    savePurchaseBasket(124, [b], 1001);
    const source = JSON.parse(sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY)!);
    const corrupt = source.entries.find((entry: { orderId: number }) => entry.orderId === 124);
    corrupt.lines[0].qty = -5;
    sessionStorage.setItem(PENDING_PURCHASE_BASKET_KEY, JSON.stringify(source));
    expect(restorePurchaseBasket(124, 1100)).toBeNull();
    expect(restorePurchaseBasket(123, 1100)).toEqual([a]);
    savePurchaseBasket(125, [b], 1200);
    expect(restorePurchaseBasket(123, 1250)).toEqual([a]);
    expect(restorePurchaseBasket(125, 1250)).toEqual([b]);
  });

  it("não estende retenção de um pedido vencido ao salvar outro", () => {
    savePurchaseBasket(123, [a], 1000);
    savePurchaseBasket(124, [b], 1000 + 86400001);
    expect(restorePurchaseBasket(123, 1000 + 86400002)).toBeNull();
    expect(restorePurchaseBasket(124, 1000 + 86400002)).toEqual([b]);
  });

  it("recusa identificadores inválidos e sacolas vazias, nunca autoriza um pagamento", () => {
    savePurchaseBasket(-1, [a]);
    savePurchaseBasket(123, []);
    expect(sessionStorage.getItem(PENDING_PURCHASE_BASKET_KEY)).toBeNull();
    expect(restorePurchaseBasket(123)).toBeNull();
  });
});
