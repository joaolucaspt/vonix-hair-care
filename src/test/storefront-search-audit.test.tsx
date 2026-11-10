import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  navigate: vi.fn(),
  audience: null as "casa" | "salao" | null,
  setAudience: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
  Link: ({
    children,
    to = "/loja",
    search,
    ...rest
  }: {
    children: React.ReactNode;
    to?: string;
    search?: Record<string, string | undefined>;
    "aria-label"?: string;
    className?: string;
  }) => {
    const params = new URLSearchParams();
    Object.entries(search ?? {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return (
      <a href={query ? `${to}?${query}` : to} {...rest}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Grid: ({ items }: { items: unknown[] }) => <div data-testid="product-grid">{items.length}</div>,
}));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useAudience: () => ({ audience: mocks.audience, set: mocks.setAudience }),
}));

import { Loja, normalizeStoreSearch, matchesStoreQuery } from "@/routes/loja";
import { getProduct } from "@/lib/store";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = {};
  mocks.audience = null;
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

  it("encontra produtos com busca sem acentos, com maiúsculas e espaços múltiplos", () => {
    const mascara = getProduct("mascara-efeito-teia-coco-nutri")!;
    const cafe = getProduct("kit-cafe-verde")!;
    expect(matchesStoreQuery(mascara, "  MASCARA  ")).toBe(true);
    expect(matchesStoreQuery(cafe, "cafe verde")).toBe(true);
    expect(matchesStoreQuery(cafe, "CAFÉ   VERDE")).toBe(true);
    expect(matchesStoreQuery(cafe, "produto inexistente")).toBe(false);
    expect(matchesStoreQuery(cafe, "combo cafe verde")).toBe(true);
    expect(matchesStoreQuery(cafe, "kit cafe verde")).toBe(true);
    expect(matchesStoreQuery(cafe, "verde kit cafe")).toBe(true);
    expect(matchesStoreQuery(cafe, "cafe kit")).toBe(true);
    expect(matchesStoreQuery(cafe, "verde combo cafe")).toBe(true);
    expect(matchesStoreQuery(cafe, "verde combos cafe")).toBe(true);
    expect(matchesStoreQuery(cafe, "cafe combos")).toBe(true);
    const botox = getProduct("botox-vonix")!;
    expect(matchesStoreQuery(botox, "1kg botox")).toBe(true);
    expect(matchesStoreQuery(botox, "2kg botox")).toBe(false);
    expect(matchesStoreQuery(cafe, "cafe produto inexistente")).toBe(false);
  });

  it("apresenta nome real da categoria filtrada em vez de anunciar todos os produtos", () => {
    mocks.search = { categoria: "kits" };
    render(<Loja />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Kits");
    expect(
      screen.getByRole("link", { name: "Remover filtro Categoria: Kits" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/10 produtos/);
  });

  it("permite remover só a categoria que impediu a busca, preservando a consulta digitada", () => {
    mocks.search = { q: "banana", categoria: "quimica" };
    render(<Loja />);
    expect(screen.getByText(/Nenhum produto encontrado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remover filtro Categoria: Química" })).toHaveAttribute(
      "href",
      "/loja?q=banana",
    );
    expect(screen.getByText(/Retire um filtro para ampliar/)).toBeInTheDocument();
  });

  it("não apresenta tipo inexistente como título mesmo se o roteador fornecer URL não normalizada", () => {
    mocks.search = { tiposProduto: "tipo-invalido", ordem: "nao-existe" };
    render(<Loja />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Todos os Produtos");
    expect(screen.getByRole("status")).toHaveTextContent("42 produtos");
    expect(screen.queryByRole("group", { name: "Filtros ativos" })).not.toBeInTheDocument();
  });

  it("remove buscas individuais, mantém outros filtros e oferece saída clara quando não há resultados", () => {
    mocks.search = { q: "termo-muito-raro", tiposProduto: "Kits" };
    render(<Loja />);
    expect(
      screen.getByRole("link", { name: "Remover filtro Busca: termo-muito-raro" }),
    ).toHaveAttribute("href", "/loja?tiposProduto=Kits");
    expect(screen.getByRole("link", { name: "Ver todos os produtos" })).toBeInTheDocument();
  });

  it("uma escolha explícita no link supera a área salva no navegador e sincroniza o cabeçalho", () => {
    mocks.audience = "casa";
    mocks.search = { uso: "salao" };
    render(<Loja />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Para Cabeleireiras");
    expect(mocks.setAudience).toHaveBeenCalledWith("salao");
    expect(screen.getByRole("link", { name: "Remover filtro Público: Salão" })).toBeInTheDocument();
  });

  it("valida busca de URL com espaço excedente e limita entrada desnecessariamente longa", () => {
    expect(normalizeStoreSearch({ q: "  banana   " })).toEqual({ q: "banana" });
    expect(normalizeStoreSearch({ q: "   " })).toEqual({});
    expect(normalizeStoreSearch({ q: "a".repeat(900) })).toEqual({ q: "a".repeat(120) });
    expect(normalizeStoreSearch({ q: 999 })).toEqual({});
    expect(normalizeStoreSearch({ tiposProduto: "Combos" })).toEqual({ tiposProduto: "Kits" });
    expect(
      normalizeStoreSearch({
        q: "Banana",
        categoria: "categoria-inexistente",
        tiposProduto: "tipo-desconhecido",
        necessidades: "preciso de tudo",
        secao: "desconhecida",
        ordem: "qualquer",
        uso: "inventado",
      }),
    ).toEqual({ q: "Banana" });
  });
});
