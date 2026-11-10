import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...rest
  }: React.PropsWithChildren<{ to: string; "aria-label"?: string }>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { AffiliateShell } from "@/components/affiliate-shell";

afterEach(cleanup);

describe("Vonix affiliate dedicated recruitment shell", () => {
  it("replaces the tall shopping chrome with a short authentic recruitment header", () => {
    render(
      <AffiliateShell>
        <h1>Seleção Vonix Hair</h1>
      </AffiliateShell>,
    );
    expect(screen.getByTestId("vonix-affiliate-shell")).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Seleção Vonix Hair" }),
    );
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveAttribute(
      "href",
      "#conteudo-afiliadas",
    );
    expect(
      screen.getByRole("link", { name: /Ver inscrição|Conhecer a inscrição/ }),
    ).toHaveAttribute("href", "#inscricao");
    expect(screen.getByRole("navigation", { name: /Navegação da seleção/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar à loja Vonix Hair" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByText(/Frete grátis/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Para cabeleireiras/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comissão de/i)).not.toBeInTheDocument();
  });

  it("renders the metallic gold Vonix mark on the dark footer without a white plaque", () => {
    render(
      <AffiliateShell>
        <p>Conteúdo</p>
      </AffiliateShell>,
    );
    const footer = screen.getByRole("contentinfo");
    const mark = footer.querySelector('[role="img"][aria-label="Vonix Hair"]');
    expect(mark).not.toBeNull();
    expect(mark).toHaveStyle({ maskRepeat: "no-repeat" });
    expect(mark).toHaveStyle({ maskSize: "contain" });
    expect(mark?.getAttribute("class")).not.toContain("bg-white");
    expect(footer.querySelector("img.bg-white")).toBeNull();
  });

  it("uses the official site-configured Vonix Instagram link, not third party creator links", () => {
    render(
      <AffiliateShell>
        <p>Conteúdo</p>
      </AffiliateShell>,
    );
    expect(screen.getByRole("link", { name: /Instagram da Vonix Hair/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/vonixhairoficial",
    );
    expect(screen.getByRole("link", { name: "Ir para o e-commerce Vonix Hair" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
