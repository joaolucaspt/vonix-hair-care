import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AffiliateLandingIntro } from "@/components/affiliate-landing";
import { AffiliateNextSteps, PUBLIC_AFFILIATE_PAGE } from "@/components/affiliate-next-steps";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Vonix Afiliadas C55 — conteúdo útil, original e transparente", () => {
  it("offers four real-product content formats with practical original scripts", () => {
    render(<AffiliateLandingIntro recruitmentStatus="closed" />);
    const region = screen.getByRole("region", {
      name: /Formatos criativos ilustrados com produtos oficiais Vonix Hair/i,
    });
    const cards = region.querySelectorAll("article");
    expect(cards).toHaveLength(4);
    const details = within(region).getAllByText("Ver ideia de roteiro");
    expect(details).toHaveLength(4);
    expect(region.querySelectorAll("details[open]")).toHaveLength(0);
    fireEvent.click(details[0]!);
    expect(region.querySelectorAll("details[open]")).toHaveLength(1);
    expect(region).toHaveTextContent("Primeiro olhar: o que é importante observar neste kit?");
    expect(region).toHaveTextContent("Mostre a embalagem e os rótulos sem alterar informações.");
    for (const card of cards) {
      expect(card.querySelectorAll("details ol li")).toHaveLength(3);
      const photo = card.querySelector("picture img");
      expect(photo?.getAttribute("src")).toMatch(/^\/images\/products\/[a-z0-9-]+\.jpg$/);
      expect(card.textContent).toContain("Identifique publicidade quando houver parceria.");
    }
    expect(region.textContent).not.toMatch(
      /cupom garantido|15% no site|21% no TikTok|ganhos reais de afiliadas|aprovada automaticamente/i,
    );
  });

  it("describes post-registration steps without implying a preview generates an application", () => {
    render(<AffiliateNextSteps recruitmentOpen={false} />);
    const section = screen.getByTestId("affiliate-c55-next-steps");
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(section).toHaveTextContent("Visualizar a prévia não gera um código ou uma candidatura.");
    expect(section).toHaveTextContent(/não existe aprovação ou prazo de resposta garantidos/i);
    expect(within(section).getByRole("link", { name: /Acompanhar candidatura/i })).toHaveAttribute(
      "href",
      "/consultar-candidatura",
    );
    expect(section.querySelector("input")).toBeNull();
    expect(section.textContent).not.toMatch(
      /envie sua senha|receba comissão agora|ganhos garantidos/i,
    );
  });

  it("shows accurate instructions when real applications are available", () => {
    render(<AffiliateNextSteps recruitmentOpen />);
    const section = screen.getByTestId("affiliate-c55-next-steps");
    expect(section).toHaveTextContent("Quando concluir sua inscrição, guarde o código recebido.");
    expect(section).not.toHaveTextContent("Visualizar a prévia não gera");
  });

  it("copies only the public selection URL — no codes, UTM, applicant or affiliate tokens", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<AffiliateNextSteps recruitmentOpen />);
    const section = screen.getByTestId("affiliate-c55-next-steps");
    fireEvent.click(within(section).getByRole("button", { name: /Copiar link do programa/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith("https://vonixhair.com/seja-afiliada");
    expect(PUBLIC_AFFILIATE_PAGE).not.toMatch(/[?#]|token|code|email/i);
    expect(screen.getByTestId("affiliate-c55-copy-result")).toHaveTextContent(
      "Link público copiado",
    );
  });

  it("handles blocked clipboard gracefully and never pretends to have copied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("not_allowed")) },
    });
    render(<AffiliateNextSteps recruitmentOpen={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link do programa/i }));
    await waitFor(() =>
      expect(screen.getByTestId("affiliate-c55-copy-result")).toHaveTextContent(
        "Não foi possível copiar",
      ),
    );
  });
});
