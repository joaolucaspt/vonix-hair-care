import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProduct, products } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  add: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/store", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  useCart: () => ({ add: mocks.add, count: 0 }),
  useFavorites: () => ({ has: () => false, toggle: vi.fn() }),
  useAudience: () => ({ audience: null, set: vi.fn() }),
}));
vi.mock("@/lib/analytics", async (load) => ({
  ...(await load<Record<string, unknown>>()),
  track: mocks.track,
}));
vi.mock("@/lib/review-summary", () => ({ useVisitorSummary: () => ({}) }));

import { ProductCard } from "@/components/site";

beforeEach(() => vi.clearAllMocks());

describe("sacola rápida da vitrine", () => {
  it("produtos com variante única vão direto para o carrinho, com evento de add_to_cart", () => {
    const p = getProduct("kit-banana-e-mel")!;
    expect(p.variants).toHaveLength(1);
    render(<ProductCard p={p} />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar ${p.name} à sacola` }));
    expect(mocks.add).toHaveBeenCalledWith(p.slug, p.variants[0].label, 1);
    expect(mocks.track).toHaveBeenCalledWith("add_to_cart", expect.objectContaining({
      value: p.variants[0].price,
    }));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("produtos com múltiplas variantes pedem tamanho antes de entrar na sacola", () => {
    const p = getProduct("kit-cachos")!;
    expect(p.variants.length).toBeGreaterThan(1);
    render(<ProductCard p={p} />);
    fireEvent.click(screen.getByRole("button", { name: `Escolher opções de ${p.name}` }));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/produto/$slug",
      params: { slug: p.slug },
    });
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("o catálogo separa variantes sem forçar escolha de quantidade nos demais produtos", () => {
    expect(products.filter((p) => p.variants.length === 1)).toHaveLength(38);
    expect(products.filter((p) => p.variants.length > 1)).toHaveLength(4);
    expect(products).toHaveLength(42);
  });
});
