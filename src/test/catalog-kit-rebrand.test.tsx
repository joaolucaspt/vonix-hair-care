import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductDetails } from "@/components/product-details";
import { getProduct, products, TYPES } from "@/lib/store";

vi.mock("@/components/site", () => ({
  Md: ({ text }: { text: string }) => <p>{text}</p>,
}));

describe("renomeação de combos para kits sem degradar a auditoria", () => {
  it("mostra 10 kits ativos, sem alterar slugs de URLs, preços ou as variantes", () => {
    const kits = products.filter((p) => p.category === "kits");
    expect(kits).toHaveLength(10);
    for (const product of kits) {
      expect(product.name).toMatch(/^Kit /);
      expect(product.categoryLabel).toBe("Kits");
      expect(TYPES["Kits"]?.(product)).toBe(true);
      expect(product.slug).toMatch(/^kit-/);
      expect(product.variants[0]?.price).toBeGreaterThan(0);
    }
    expect(getProduct("kit-banana-e-mel")?.variants[0]?.price).toBe(169.9);
    expect(getProduct("kit-cafe-verde")?.variants[0]?.price).toBe(125.9);
  });

  it("não restaura a promessa de transportadora nem frete fixo nos 42 produtos ativos", () => {
    expect(products).toHaveLength(42);
    for (const product of products) {
      expect(product.description, product.slug).toContain(
        "As opções de entrega disponíveis para o seu CEP aparecem no checkout",
      );
      expect(product.description, product.slug).not.toContain(
        "Enviamos para todo o Brasil por Loggi, Jadlog",
      );
    }
  });

  it("detalha corretamente o conteúdo do novo Kit e de uma descrição legada Combo", () => {
    const p = getProduct("kit-banana-e-mel")!;
    expect(p.description).toContain("**O QUE VEM NO KIT**");
    const { rerender } = render(<ProductDetails p={p} />);
    expect(screen.getByText("Este kit contém").nextElementSibling).toHaveTextContent("4 produtos");
    const old = {
      ...p,
      description: p.description.replace("**O QUE VEM NO KIT**", "**O QUE VEM NO COMBO**"),
    };
    rerender(<ProductDetails p={old} />);
    expect(screen.getByText("Este kit contém").nextElementSibling).toHaveTextContent("4 produtos");
  });
});
