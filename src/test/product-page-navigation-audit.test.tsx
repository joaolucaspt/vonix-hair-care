import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  slug: "kit-cachos",
  product: null as unknown,
  add: vi.fn(),
  track: vi.fn(),
  navigate: vi.fn(),
  favorites: new Set<string>(),
  quote: vi.fn(),
  address: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useLoaderData: () => mocks.product,
  }),
  useNavigate: () => mocks.navigate,
  notFound: vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/loja">{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/address.functions", () => ({ lookupAddress: mocks.address }));
vi.mock("@/lib/checkout.functions", () => ({ quoteShipping: mocks.quote }));
vi.mock("@/lib/analytics", () => ({
  toItem: () => ({}),
  track: mocks.track,
}));
vi.mock("@/lib/store", async (load) => {
  const actual = await load<Record<string, unknown>>();
  return {
    ...actual,
    useCart: () => ({ add: mocks.add }),
    useFavorites: () => ({
      has: (slug: string) => mocks.favorites.has(slug),
      toggle: (slug: string) => {
        if (mocks.favorites.has(slug)) mocks.favorites.delete(slug);
        else mocks.favorites.add(slug);
      },
    }),
    useAudience: () => ({ audience: null }),
  };
});
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  Grid: () => null,
  PaymentMethods: () => null,
  PixMark: () => null,
  SecuritySeal: () => null,
  Stars: () => null,
}));
vi.mock("@/components/product-gallery", () => ({ ProductGallery: () => null }));
vi.mock("@/components/product-details", () => ({ ProductDetails: () => null }));
vi.mock("@/components/reviews", () => ({
  ProductReviews: () => null,
  reviewsFor: () => [],
}));
vi.mock("@/components/share-button", () => ({ ShareButton: () => null }));
vi.mock("@/components/buy-drawer", () => ({ BuyDrawer: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

import { Route } from "@/routes/produto.$slug";
import { getProduct } from "@/lib/store";

const ProductPage = (Route as unknown as { component: React.ComponentType }).component;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.slug = "kit-cachos";
  mocks.product = getProduct(mocks.slug)!;
  mocks.favorites.clear();
});
afterEach(() => cleanup());

describe("segurança e acessibilidade na página de produto", () => {
  it("mostra frete grátis pelo subtotal bruto quando duas unidades têm desconto por volume", async () => {
    const p = getProduct("queratina-em-gel")!;
    expect(p.variants[0].price).toBe(81.9);
    mocks.product = p;
    mocks.quote.mockResolvedValueOnce({
      ok: true,
      options: [{ id: 42, name: "PAC", company: "Correios", price: 0, days: 5, free: true }],
    });
    mocks.address.mockResolvedValueOnce({
      ok: true,
      address: { street: "Rua Exemplo", district: "Centro", city: "Belo Horizonte", uf: "MG" },
    });
    render(<ProductPage />);
    fireEvent.click(screen.getByRole("radio", { name: /Leve 2 unidades/i }));
    expect(screen.getByTestId("qty")).toHaveTextContent("2");
    fireEvent.change(screen.getByLabelText("CEP de entrega"), { target: { value: "30140010" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    await waitFor(() =>
      expect(mocks.quote).toHaveBeenCalledWith({
        data: { cep: "30140010", items: [{ slug: p.slug, variant: p.variants[0].label, qty: 2 }] },
      }),
    );
    expect(await screen.findByText(/Correios PAC/)).toBeInTheDocument();
    expect(screen.getByText(/Frete Grátis — pedido acima de R\$ 150/)).toHaveTextContent(
      "calculado antes dos descontos",
    );
  });

  it("ao navegar entre produtos, inicia o novo SKU com 1 unidade e primeira variante", () => {
    const source = getProduct("kit-cachos")!;
    const next = getProduct("kit-banana-e-mel")!;
    const view = render(<ProductPage />);
    expect(screen.getByRole("heading", { name: source.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Leve 3 unidades/i }));
    expect(screen.getByTestId("qty")).toHaveTextContent("3");
    expect(source.variants.length).toBeGreaterThan(1);
    fireEvent.click(
      screen.getByRole("button", { name: (name) => name.includes(source.variants[1]!.label) }),
    );

    mocks.slug = next.slug;
    mocks.product = next;
    view.rerender(<ProductPage />);
    expect(screen.getByRole("heading", { name: next.name })).toBeInTheDocument();
    expect(screen.getByTestId("qty")).toHaveTextContent("1");
    expect(
      screen.getByRole("button", { name: `Diminuir quantidade de ${next.name}` }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(mocks.add).toHaveBeenCalledWith(next.slug, next.variants[0]!.label, 1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("indica o estado de favoritos e não anuncia uma quantidade fora do limite", () => {
    const product = getProduct("kit-cachos")!;
    const view = render(<ProductPage />);
    const addFav = screen.getByRole("button", { name: `Adicionar ${product.name} aos favoritos` });
    expect(addFav).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(addFav);
    view.rerender(<ProductPage />);
    const removeFav = screen.getByRole("button", { name: `Remover ${product.name} dos favoritos` });
    expect(removeFav).toHaveAttribute("aria-pressed", "true");

    const increase = screen.getByRole("button", { name: `Aumentar quantidade de ${product.name}` });
    for (let index = 0; index < 100; index++) fireEvent.click(increase);
    expect(screen.getByTestId("qty")).toHaveTextContent("99");
    expect(increase).toBeDisabled();
  });
});
