import { cleanup, render, screen, within } from "@testing-library/react";
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

import { AffiliateBrandTrust } from "@/components/affiliate-brand-trust";
import { AffiliateLandingIntro } from "@/components/affiliate-landing";
import { AffiliateShell } from "@/components/affiliate-shell";

afterEach(cleanup);

describe("C58 genuine Vonix credibility before applying", () => {
  it("shows only verified brand facts, with direct paths to official sources", () => {
    render(<AffiliateBrandTrust recruitmentOpen={false} />);
    const section = screen.getByTestId("affiliate-c58-brand-trust");
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Uma loja real");
    expect(within(section).getByRole("link", { name: /Conhecer o catálogo/ })).toHaveAttribute(
      "href",
      "/loja",
    );
    expect(within(section).getByRole("link", { name: /Conhecer a marca/ })).toHaveAttribute(
      "href",
      "/sobre",
    );
    expect(within(section).getByRole("link", { name: /Consultar entregas/ })).toHaveAttribute(
      "href",
      "/politica-de-frete",
    );
    expect(
      within(section).getByRole("link", { name: /Ver avaliações reais de produtos/ }),
    ).toHaveAttribute("href", "#avaliacoes-produtos");
    expect(within(section).getByRole("link", { name: /Ver como se candidatar/ })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    expect(section).toHaveTextContent("Não são imagens de candidatas, creators");
    expect(section).toHaveTextContent("não de afiliadas participantes");
    expect(section.textContent).not.toMatch(
      /3 milh[õo]es|depoimentos de afiliadas aprovadas|cupom garantido|20% de comissão|ganhos garantidos/i,
    );
  });

  it("uses two authentic lazy-loaded catalog photos, not stock creator portraits", () => {
    render(<AffiliateBrandTrust recruitmentOpen={true} />);
    const section = screen.getByTestId("affiliate-c58-brand-trust");
    const pictures = section.querySelectorAll("picture");
    expect(pictures).toHaveLength(2);
    for (const picture of pictures) {
      const image = picture.querySelector("img");
      const source = picture.querySelector("source");
      expect(image?.getAttribute("src")).toMatch(/^\/images\/products\/[a-z0-9-]+\.jpg$/);
      expect(image?.getAttribute("alt")).toContain("Vonix");
      expect(image?.getAttribute("loading")).toBe("lazy");
      expect(source?.getAttribute("srcset")).toMatch(/^\/images\/products\/[a-z0-9-]+\.webp$/);
    }
    expect(
      within(section).getByRole("link", { name: /Quero apresentar meu perfil/ }),
    ).toHaveAttribute("href", "#inscricao");
    expect(within(section).queryByRole("link", { name: /Ver como se candidatar/ })).toBeNull();
  });

  it("puts verified store content before earnings and keeps product reviews reachable", () => {
    const { container } = render(<AffiliateLandingIntro recruitmentStatus="closed" />);
    const brand = screen.getByTestId("affiliate-c58-brand-trust");
    const earnings = screen.getByTestId("vonix-affiliate-earnings");
    expect(brand.compareDocumentPosition(earnings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const productReviews = screen.getByTestId("vonix-c53-real-product-reviews");
    expect(productReviews).toHaveAttribute("id", "avaliacoes-produtos");
    expect(container.querySelectorAll("#avaliacoes-produtos")).toHaveLength(1);
    expect(productReviews).toHaveTextContent("Não são depoimentos de afiliadas");
  });

  it("differentiates open recruitment from form preview in the sticky header", () => {
    const { rerender } = render(
      <AffiliateShell recruitmentStatus="closed">
        <p>Conteúdo</p>
      </AffiliateShell>,
    );
    const before = document.querySelector('header a[href="#inscricao"]');
    expect(before?.textContent).toContain("Ver inscrição");
    expect(before?.textContent).not.toContain("Quero participar");
    rerender(
      <AffiliateShell recruitmentStatus="open">
        <p>Conteúdo</p>
      </AffiliateShell>,
    );
    const after = document.querySelector('header a[href="#inscricao"]');
    expect(after?.textContent).toContain("Quero participar");
    expect(after?.textContent).toContain("Enviar candidatura");
    expect(after?.getAttribute("href")).toBe("#inscricao");
  });
});
