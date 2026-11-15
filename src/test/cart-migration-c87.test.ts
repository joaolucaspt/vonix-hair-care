import { describe, expect, it } from "vitest";
import { migrateCart, type CartItem } from "@/lib/store";

const kit = { slug: "kit-banana-e-mel", variant: "Kit" };
const asCart = (value: unknown) => value as CartItem[];

describe("C87 — recuperação de carrinho persistido", () => {
  it("descarta linhas com quantidade zero, negativa, decimal, infinita ou nula", () => {
    for (const qty of [0, -2, 1.5, Number.POSITIVE_INFINITY, Number.NaN, null]) {
      expect(migrateCart(asCart([{ ...kit, qty }]))).toEqual([]);
    }
  });

  it("ignora apenas a linha inválida, sem apagar a compra válida", () => {
    expect(migrateCart(asCart([null, false, { slug: "", variant: "Kit", qty: 1 }, { ...kit, qty: 1 }]))).toEqual([
      { ...kit, qty: 1 },
    ]);
  });

  it("recupera quantidades numéricas antigas em string, sem concatenar como texto", () => {
    expect(migrateCart(asCart([{ ...kit, qty: "2" }, { ...kit, qty: 1 }]))).toEqual([
      { ...kit, qty: 3 },
    ]);
    expect(migrateCart(asCart([{ ...kit, qty: " 03 " }, { ...kit, qty: 2 }]))).toEqual([
      { ...kit, qty: 5 },
    ]);
    expect(migrateCart(asCart([{ ...kit, qty: "2.5" }]))).toEqual([]);
  });

  it("preserva o limite 99, sem transformar duas compras válidas em quantidades negativas", () => {
    expect(migrateCart(asCart([{ ...kit, qty: 98 }, { ...kit, qty: 3 }]))).toEqual([{ ...kit, qty: 99 }]);
    expect(migrateCart(asCart([{ ...kit, qty: "200" }]))).toEqual([{ ...kit, qty: 99 }]);
  });

  it("mantém a migração dos kits 2/3 antigos e complemento 5% separados", () => {
    const migrated = migrateCart(
      asCart([
        { ...kit, qty: 2, offer: "kit2" },
        { ...kit, qty: 1, offer: "kit3" },
        { ...kit, qty: 1, offer: "comp5" },
      ]),
    );
    expect(migrated).toEqual([{ ...kit, qty: 7 }, { ...kit, qty: 1, offer: "comp5" }]);
  });

  it("carrinho raiz ilegível e entradas sem variante não causam exceção", () => {
    expect(migrateCart(asCart({ unexpected: true }))).toEqual([]);
    expect(migrateCart(asCart([{ slug: kit.slug, qty: 1 }, { ...kit, qty: 1 }]))).toEqual([
      { ...kit, qty: 1 },
    ]);
  });
});
