import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ status: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/affiliate-functions", () => ({
  getAffiliateRecruitmentStatus: server.status,
  submitSimpleAffiliateApplication: server.submit,
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { AffiliateApplicationPage, Route } from "@/routes/seja-afiliada";
import { AffiliateLandingIntro } from "@/components/affiliate-landing";

beforeEach(() => {
  vi.resetAllMocks();
  server.status.mockResolvedValue({ open: false });
});
afterEach(cleanup);

describe("C53 recruitment presentation boundaries", () => {
  it("provides real local product pictures, not affiliate testimonials or third-party portraits", () => {
    const { container } = render(<AffiliateLandingIntro recruitmentStatus="closed" />);
    const sources = [...container.querySelectorAll("source")];
    expect(sources.length).toBeGreaterThanOrEqual(8);
    for (const source of sources)
      expect(source.getAttribute("srcset")).toMatch(/^\/images\/products\/[a-z0-9-]+\.webp$/);
    expect(screen.getAllByText(/Não são depoimentos de afiliadas/).length).toBeGreaterThan(0);
    expect(container.querySelectorAll("blockquote")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /catálogo na loja oficial/ })).toHaveAttribute(
      "href",
      "/loja",
    );
    expect(container.textContent).not.toMatch(
      /aprovação garantida|ganhos garantidos|receba produtos grátis|5 etapas/,
    );
  });

  it("identifies authentic storefront comments as PRODUCT reviews, not affiliate earnings", () => {
    const { container } = render(<AffiliateLandingIntro recruitmentStatus="closed" />);
    const evidence = screen.getByTestId("vonix-c53-real-product-reviews");
    expect(evidence.querySelectorAll("blockquote")).toHaveLength(3);
    for (const name of ["Fernanda Assis", "Ayla Muniz", "Mariana Andrade"])
      expect(evidence).toHaveTextContent(name);
    expect(evidence).toHaveTextContent("Não são depoimentos de afiliadas");
    expect(evidence).toHaveTextContent("Eles não representam renda, vendas, comissões");
    expect(evidence.querySelector('a[href="/produto/botox-vonix"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(
      /depoimentos de afiliadas aprovadas|ganhos reais de afiliadas/i,
    );
    const topics = screen.getByRole("region", { name: /Temas da seleção Vonix Hair/ });
    expect(topics.querySelectorAll("picture img")).toHaveLength(4);
    for (const img of topics.querySelectorAll("img"))
      expect(img.getAttribute("alt")).toContain("Vonix");
  });

  it("keeps all application and earnings anchors valid and status navigation separate", async () => {
    const { container } = render(<AffiliateApplicationPage />);
    await screen.findByText("Inscrições em preparação");
    for (const link of container.querySelectorAll('a[href^="#"]')) {
      const id = link.getAttribute("href")?.slice(1);
      expect(id && document.getElementById(id)).toBeTruthy();
    }
    for (const link of screen.getAllByRole("link", { name: "Ganhos" }))
      expect(link).toHaveAttribute("href", "#ganhos");
    expect(screen.getByRole("link", { name: "Status" })).toHaveAttribute(
      "href",
      "/consultar-candidatura",
    );
  });

  it("retains the actual simplified form and does not post any preview data", async () => {
    render(<AffiliateApplicationPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Visualizar formulário/ }));
    for (const label of [
      /Nome completo/,
      /Telefone com DDD/,
      /^CEP/,
      /^Número/,
      /^Instagram/,
      /Seguidores no Instagram/,
    ])
      expect(screen.getByLabelText(label)).toBeRequired();
    expect(screen.getByLabelText(/^TikTok/)).not.toBeRequired();
    expect(screen.queryByLabelText(/CPF|Data de nascimento|Motivação/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Exemplo C53" } });
    fireEvent.click(screen.getByRole("button", { name: "Simular envio" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Simular envio" })).toBeEnabled(),
    );
    expect(server.submit).not.toHaveBeenCalled();
    expect(screen.getByText("Prévia: não envia nem armazena candidaturas.")).toBeInTheDocument();
  });

  it("keeps public SEO conditional on selection, without modifying private routes", () => {
    const head = (
      Route as unknown as {
        head: () => {
          meta: { name?: string; property?: string; content?: string; title?: string }[];
        };
      }
    ).head();
    expect(head.meta.find((meta) => meta.property === "og:type")?.content).toBe("website");
    expect(head.meta.find((meta) => meta.name === "twitter:card")?.content).toBe(
      "summary_large_image",
    );
    expect(head.meta.find((meta) => meta.name === "description")?.content).toMatch(
      /sem garantia de ganhos/,
    );
    expect(head.meta.find((meta) => meta.name === "robots")?.content).toBe("index,follow");
  });
});
