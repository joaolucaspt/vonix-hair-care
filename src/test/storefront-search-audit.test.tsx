import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/loja">{children}</a>,
}));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Grid: ({ items }: { items: unknown[] }) => <div data-testid="product-grid">{items.length}</div>,
}));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useAudience: () => ({ audience: null }),
}));

import { Loja, normalizeStoreSearch } from "@/routes/loja";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = {};
});

describe("busca e filtros do catálogo público", () => {
  it("oferece botão Buscar com formulário acessível a toque e Enter, sem navegar para checkout", () => {
    render(<Loja />);
    const form = screen.getByRole("search", { name: "Buscar produtos" });
    const input = screen.getByRole("searchbox", { name: "Buscar na loja" });
    expect(form).toContainElement(input);
    fireEvent.change(input, { target: { value: "  Banana  " } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(mocks.navigate).toHaveBeenCalledOnce();
    const action = mocks.navigate.mock.calls[0]![0];
    expect(action.search({})).toEqual({ q: "Banana" });
  });

  it("valida busca de URL com espaço excedente e limita entrada desnecessariamente longa", () => {
    expect(normalizeStoreSearch({ q: "  banana   " })).toEqual({ q: "banana" });
    expect(normalizeStoreSearch({ q: "   " })).toEqual({});
    expect(normalizeStoreSearch({ q: "a".repeat(900) })).toEqual({ q: "a".repeat(120) });
    expect(normalizeStoreSearch({ q: 999 })).toEqual({});
  });
});
