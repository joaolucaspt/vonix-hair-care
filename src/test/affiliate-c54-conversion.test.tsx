import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateCreatorPaths } from "@/components/affiliate-creator-paths";
import { AffiliateApplicationPrep } from "@/components/affiliate-application-prep";
import { AffiliateLandingIntro } from "@/components/affiliate-landing";

afterEach(cleanup);

describe("Vonix Afiliadas C54: escolha de estilo sem criar promessa comercial", () => {
  it("oferece dois caminhos reais, acessíveis e sem exigir um portfólio", () => {
    render(<AffiliateCreatorPaths />);
    const section = screen.getByTestId("affiliate-c54-creator-paths");
    const tabs = within(section).getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(within(section).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs[0]!.id);
    expect(section).toHaveTextContent(/sem precisar de um portfólio profissional/);
    expect(section).toHaveTextContent(/não categorias de aprovação/);
    expect(within(section).getByRole("link", { name: /apresentar meu perfil/i })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    const photo = within(section).getByRole("img");
    expect(photo).toHaveAttribute("src", "/images/products/kit-banana-e-mel.webp");
    expect(photo.getAttribute("alt")).toMatch(/fotografia de produto do catálogo/i);
  });

  it("troca entre rotina e UGC com clique e teclado, sem coletar perfil nem enviar dados", () => {
    render(<AffiliateCreatorPaths />);
    const routine = screen.getByRole("tab", { name: /Compartilho minha rotina/i });
    const ugc = screen.getByRole("tab", { name: /Exploro fotos e vídeos/i });
    fireEvent.click(ugc);
    expect(ugc).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", ugc.id);
    expect(within(screen.getByRole("tabpanel")).getByRole("img")).toHaveAttribute(
      "src",
      "/images/products/mascara-reparacao-nutri-repair.webp",
    );
    expect(screen.getByText(/Sua criatividade pode aparecer nos detalhes/i)).toBeInTheDocument();
    fireEvent.keyDown(ugc, { key: "ArrowRight" });
    expect(routine).toHaveAttribute("aria-selected", "true");
    expect(routine).toHaveFocus();
    fireEvent.keyDown(routine, { key: "End" });
    expect(ugc).toHaveAttribute("aria-selected", "true");
    expect(ugc).toHaveFocus();
    expect(screen.getByTestId("affiliate-c54-creator-paths")).not.toHaveTextContent(
      /cupom garantido|produtos grátis|ganhos garantidos|3 milhões de alcance/i,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("explica o que preparar para a candidatura e deixa TikTok opcional", () => {
    render(<AffiliateApplicationPrep />);
    const guide = screen.getByTestId("affiliate-c54-preparation");
    expect(within(guide).getAllByRole("listitem")).toHaveLength(4);
    expect(guide).toHaveTextContent(/Nome completo e telefone/i);
    expect(guide).toHaveTextContent(/CEP, rua, número, bairro, cidade e estado/i);
    expect(guide).toHaveTextContent(/quantidade aproximada de seguidores/i);
    expect(guide).toHaveTextContent(/É opcional/i);
    expect(within(guide).getByRole("link", { name: /Política de Privacidade/i })).toHaveAttribute(
      "href",
      "/politica-de-privacidade",
    );
    expect(guide).toHaveTextContent(/não garante aprovação/i);
    expect(guide).not.toHaveTextContent(
      /taxa de inscrição|aprovada automaticamente|receber produtos grátis/i,
    );
    expect(guide.querySelector("input")).toBeNull();
  });

  it.each([
    ["open", "Candidaturas abertas para análise"],
    ["loading", "Consultando disponibilidade de inscrição"],
    ["limited", "Inscrição temporariamente limitada nesta conexão"],
    ["closed", "Conheça o formulário enquanto as inscrições estão em preparação"],
  ] as const)("exibe no hero o estado %s sem prometer aprovação", (status, message) => {
    render(<AffiliateLandingIntro recruitmentStatus={status} />);
    const hero = screen.getByTestId("vonix-affiliate-hero");
    expect(within(hero).getByRole("status")).toHaveTextContent(message);
    expect(hero).toHaveTextContent(/A candidatura não garante aprovação/i);
    expect(
      within(hero)
        .getAllByRole("link")
        .some((x) => x.getAttribute("href") === "#inscricao"),
    ).toBe(true);
  });
});
