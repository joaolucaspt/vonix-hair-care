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
vi.mock("@/components/site", () => ({
  Shell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/store", () => ({ SITE_URL: "https://vonixhair.com" }));
vi.mock("@/components/affiliate-wizard", () => ({
  AffiliateWizard: ({ preview }: { preview: boolean }) => (
    <div data-testid="wizard">
      <span>{preview ? "Simulação protegida" : "Formulário de envio"}</span>
      <input aria-label="Rascunho sintético" defaultValue="" />
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
