import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock("@/lib/affiliate-functions", () => ({
  getAffiliateRecruitmentStatus: server.status,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/store", () => ({ SITE_URL: "https://vonixhair.com" }));
vi.mock("@/components/affiliate-wizard", () => ({
  AffiliateWizard: ({
    preview,
    onDraftChange,
  }: {
    preview: boolean;
    onDraftChange?: (dirty: boolean) => void;
  }) => (
    <div data-testid="wizard">
      <span>{preview ? "Simulação protegida" : "Formulário de envio"}</span>
      <input
        aria-label="Rascunho sintético"
        defaultValue=""
        onChange={(event) => onDraftChange?.(event.target.value.length > 0)}
      />
    </div>
  ),
}));

import { AffiliateApplicationPage as Page } from "@/routes/seja-afiliada";
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Página pública de inscrições da Vonix", () => {
  it("mantém a prévia protegida após reabertura das inscrições e exige reinício para envio real", async () => {
    server.status.mockResolvedValueOnce({ open: false }).mockResolvedValueOnce({ open: true });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Visualizar formulário/ }));
    expect(screen.getByText("Simulação protegida")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Dados fictícios em prévia" },
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(server.status).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Simulação protegida")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Dados fictícios em prévia",
    );
    fireEvent.click(screen.getByRole("button", { name: /Iniciar inscrição real/ }));
    expect(screen.getByText(/Descartar os dados desta prévia/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar dados e iniciar inscrição real" }),
    );
    expect(screen.getByText("Formulário de envio")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue("");
  });

  it("fecha imediatamente uma prévia vazia sem exigir confirmação desnecessária", async () => {
    server.status.mockResolvedValue({ open: false });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Visualizar formulário/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));
    expect(screen.queryByText(/Descartar os dados desta prévia/)).not.toBeInTheDocument();
    expect(screen.getByText("Inscrições em preparação")).toBeInTheDocument();
  });

  it("confirma antes de fechar uma prévia com dados preenchidos e mantém os dados ao cancelar", async () => {
    server.status.mockResolvedValue({ open: false });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Visualizar formulário/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Rascunho privado de teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));
    expect(screen.getByText(/Descartar os dados desta prévia/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Rascunho privado de teste",
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuar preenchendo" }));
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Rascunho privado de teste",
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar prévia" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar dados e fechar prévia" }));
    expect(screen.queryByRole("textbox", { name: "Rascunho sintético" })).not.toBeInTheDocument();
    expect(screen.getByText("Inscrições em preparação")).toBeInTheDocument();
  });

  it("pede confirmação antes de reiniciar como inscrição real após abrir o programa", async () => {
    server.status.mockResolvedValueOnce({ open: false }).mockResolvedValueOnce({ open: true });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Visualizar formulário/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Não pode ser enviado automaticamente" },
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    fireEvent.click(screen.getByRole("button", { name: /Iniciar inscrição real/ }));
    expect(screen.getByText(/Descartar os dados desta prévia/)).toBeInTheDocument();
    expect(screen.getByText("Simulação protegida")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar dados e iniciar inscrição real" }),
    );
    expect(screen.getByText("Formulário de envio")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue("");
  });

  it("preserva rascunho já iniciado quando inscrições são fechadas durante o preenchimento", async () => {
    server.status.mockResolvedValueOnce({ open: true }).mockResolvedValueOnce({ open: false });
    render(<Page />);
    expect(await screen.findByText("Formulário de envio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Perfil fictício ainda não enviado" },
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(server.status).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Simulação protegida")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Perfil fictício ainda não enviado",
    );
    expect(screen.getByText(/cadastro não recebe candidaturas/)).toBeInTheDocument();
  });

  it("descarta respostas de disponibilidade antigas quando a aba dispara verificações concorrentes", async () => {
    let finishOld!: (value: { open: boolean }) => void;
    server.status
      .mockResolvedValueOnce({ open: true })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce({ open: true });
    render(<Page />);
    expect(await screen.findByText("Formulário de envio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Rascunho que deve continuar aqui" },
    });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(server.status).toHaveBeenCalledTimes(3));
    await act(async () => finishOld({ open: false }));
    expect(screen.getByText("Formulário de envio")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Rascunho que deve continuar aqui",
    );
  });

  it("falha fechado durante indisponibilidade de atualização sem destruir um rascunho", async () => {
    server.status.mockResolvedValueOnce({ open: true }).mockRejectedValueOnce(new Error("offline"));
    render(<Page />);
    expect(await screen.findByText("Formulário de envio")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Rascunho sintético" }), {
      target: { value: "Perfil fictício" },
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(server.status).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Simulação protegida")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rascunho sintético" })).toHaveValue(
      "Perfil fictício",
    );
  });
});

describe("Landing editorial Vonix Hair — conteúdo próprio e promessas verificáveis", () => {
  it("usa exclusivamente produtos Vonix sem importar prova social ou benefícios da marca-referência", async () => {
    server.status.mockResolvedValue({ open: false });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    const landing = screen.getByTestId("vonix-affiliate-editorial");
    const text = landing.textContent ?? "";

    expect(text).toContain("Vonix Hair");
    expect(text).toContain("Inscrição gratuita");
    expect(text).toContain("A candidatura não garante aprovação");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Seu jeito de criar.");
    expect(screen.getByRole("heading", { name: /Não procuramos uma fórmula/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Crie do seu jeito/i })).toBeInTheDocument();

    const forbidden = [
      /Skence/i,
      /Pliv Pro/i,
      /TikTok Shop/i,
      /3 milhões/i,
      /(?:15|21)\s*%/,
      /R\$\s*30(?:[.,]00)?/i,
      /PIX no dia 10/i,
      /comissão por vendas/i,
      /produto com desconto/i,
      /depoimento[s]? de creator/i,
      /parceria garantida/i,
    ];
    forbidden.forEach((pattern) =>
      expect(text, "Forbidden marketing claim: " + pattern).not.toMatch(pattern),
    );

    const images = Array.from(landing.querySelectorAll("img"));
    expect(images.length).toBeGreaterThanOrEqual(8);
    images.forEach((img) => {
      expect(img.getAttribute("src")).toMatch(/^\/images\/products\/[a-z0-9-]+\.jpg$/);
      expect(img.getAttribute("alt")?.toLowerCase()).toContain("vonix");
      expect(img.getAttribute("alt")).not.toMatch(/creator|parceria|depoimento/i);
    });
    expect(document.querySelector("#inscricao")).not.toBeNull();
    expect(screen.getByText("Inscrições em preparação")).toBeInTheDocument();
  });

  it("explica etapas e condições sem inventar comissões ou garantir aprovação", async () => {
    server.status.mockResolvedValue({ open: false });
    render(<Page />);
    const heading = await screen.findByRole("heading", { name: /Três momentos/i });
    expect(heading).toBeInTheDocument();
    for (const step of ["Apresente seu perfil", "Análise individual", "Próximos passos"]) {
      expect(screen.getByRole("heading", { name: step })).toBeInTheDocument();
    }
    const landing = screen.getByTestId("vonix-affiliate-editorial");
    expect(landing.querySelectorAll('a[href="#inscricao"]').length).toBeGreaterThanOrEqual(3);
    expect(landing.textContent).toMatch(/candidatura não garante aprovação/i);
    expect(screen.queryByText(/receba comissão de \d+%/i)).not.toBeInTheDocument();
  });

  it("inclui FAQ acessível, com candidatura sem compra obrigatória e aviso de que vantagens dependem de aprovação", async () => {
    server.status.mockResolvedValue({ open: false });
    render(<Page />);
    expect(await screen.findByText("Inscrições em preparação")).toBeInTheDocument();
    const faq = screen.getByTestId("vonix-affiliate-faq");
    const items = Array.from(faq.querySelectorAll("details"));
    expect(items).toHaveLength(6);
    const question = screen.getByText("Preciso comprar algum produto para me inscrever?");
    const disclosure = question.closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(question);
    expect(disclosure).toHaveAttribute("open");
    expect(disclosure?.textContent).toContain("A candidatura por este formulário é gratuita");
    expect(faq.textContent).toContain("não garante produtos gratuitos, cupons ativos, remuneração");
  });

  it("ajusta o CTA para período de recebimento aberto sem transformar uma prévia em candidatura", async () => {
    server.status.mockResolvedValue({ open: true });
    render(<Page />);
    expect(await screen.findByText("Formulário de envio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Enviar minha candidatura/ })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    expect(screen.getByRole("link", { name: /Preencher candidatura/ })).toHaveAttribute(
      "href",
      "#inscricao",
    );
    expect(screen.queryByText("Inscrições em preparação")).not.toBeInTheDocument();
  });
});
