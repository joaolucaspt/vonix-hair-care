import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  pathname: "/loja",
  back: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    params,
    ...rest
  }: React.PropsWithChildren<{
    to: string;
    search?: unknown;
    params?: unknown;
    "aria-label"?: string;
    className?: string;
    onClick?: () => void;
  }>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: mocks.pathname }),
  useRouter: () => ({ history: { back: mocks.back } }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/prize-wheel", () => ({ PrizeWheel: () => null }));
vi.mock("@/components/affiliate-popup", () => ({ AffiliatePopup: () => null }));
vi.mock("@/lib/store", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useCart: () => ({ count: 0 }),
  useAudience: () => ({ audience: null, set: vi.fn() }),
}));

import { Shell } from "@/components/site";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  mocks.pathname = "/loja";
  vi.clearAllMocks();
});

describe("menu global Vonix acessível a teclado e celular", () => {
  it("abre como diálogo modal focado e fecha com Escape devolvendo foco ao abridor", () => {
    render(
      <Shell>
        <h1>Loja</h1>
      </Shell>,
    );
    const opener = screen.getByRole("button", { name: "Abrir menu" });
    expect(opener).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Menu rápido" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(opener).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByRole("link", { name: "Seja afiliada" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu rápido" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("oferece caminho direto para a loja em páginas abertas sem histórico, sem distrair checkout", () => {
    mocks.pathname = "/produto/kit-banana-e-mel";
    const view = render(
      <Shell>
        <h1>Produto</h1>
      </Shell>,
    );
    expect(screen.getByRole("link", { name: "Explorar loja" })).toHaveAttribute("href", "/loja");
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    view.unmount();
    mocks.pathname = "/checkout";
    render(
      <Shell>
        <h1>Pagamento</h1>
      </Shell>,
    );
    expect(screen.queryByRole("link", { name: "Explorar loja" })).not.toBeInTheDocument();
  });

  it("fecha ao clicar na sombra externa ou no X, sem perder a navegação do e-commerce", () => {
    render(
      <Shell>
        <p>Produtos da loja</p>
      </Shell>,
    );
    const opener = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Menu rápido" });
    expect(within(dialog).getByRole("link", { name: "Kits" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(opener);
    const overlay = screen.getByRole("dialog").parentElement!;
    fireEvent.click(overlay);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
