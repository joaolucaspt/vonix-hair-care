import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  getAffiliateAdminSession: vi.fn(),
  getAffiliateApplications: vi.fn(),
  loginAffiliateAdmin: vi.fn(),
  logoutAffiliateAdmin: vi.fn(),
  reviewAffiliateApplication: vi.fn(),
}));

vi.mock("@/lib/affiliate-functions", () => server);
vi.mock("@/components/site", () => ({ LOGO: "/logo-test.svg" }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

import { AffiliateAdminPage as Page } from "@/routes/admin.afiliadas";
const candidate = {
  id: "00000000-0000-4000-8000-000000000002",
  full_name: "Segredo da candidata",
  age: 25,
  city: "Belo Horizonte",
  state: "MG",
  hair_type: "Cacheado",
  email: "secret-candidate@example.invalid",
  instagram_url: "https://instagram.com/qa",
  tiktok_url: "https://tiktok.com/@qa",
  motivation: "Esta é uma motivação fictícia criada para verificar o painel em testes.",
  status: "pendente",
  created_at: "2026-11-09T12:00:00Z",
  reviewed_at: null,
  vonix_affiliate_mail_outbox: [],
};

function list(applications: unknown[] = [candidate]) {
  return {
    ok: true,
    applications,
    total: applications.length,
    stats: { pendente: applications.length, aprovada: 0, recusada: 0 },
    mailStats: { pendente: 0, processando: 0, enviado: 0, falhou: 0, incerto: 0 },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  server.getAffiliateAdminSession.mockResolvedValue({ authenticated: true });
  server.logoutAffiliateAdmin.mockResolvedValue({ ok: true });
  server.loginAffiliateAdmin.mockResolvedValue({ ok: true });
  server.getAffiliateApplications.mockResolvedValue(list());
});

afterEach(() => cleanup());

describe("Vonix affiliate private panel", () => {
  it("does not restore candidate PII from a request that resolves after logout", async () => {
    let resolveStale!: (value: ReturnType<typeof list>) => void;
    const stale = new Promise<ReturnType<typeof list>>((resolve) => {
      resolveStale = resolve;
    });
    server.getAffiliateApplications.mockResolvedValueOnce(list()).mockReturnValueOnce(stale);

    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aprovadas/i }));
    await waitFor(() => expect(server.getAffiliateApplications).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
    expect(screen.queryByText("secret-candidate@example.invalid")).not.toBeInTheDocument();

    await act(async () => {
      resolveStale(list());
    });
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
    expect(screen.queryByText("secret-candidate@example.invalid")).not.toBeInTheDocument();
  });

  it("clears candidate PII when authorization expires on an admin request", async () => {
    server.getAffiliateApplications
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce({ ok: false, reason: "Acesso negado. Faça login novamente." });

    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aprovadas/i }));
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
  });

  it("does not restore a decision notice or private data when logout wins the race", async () => {
    let resolveDecision!: (value: { ok: true; emailSent: false }) => void;
    const pendingDecision = new Promise<{ ok: true; emailSent: false }>((resolve) => {
      resolveDecision = resolve;
    });
    server.reviewAffiliateApplication.mockReturnValueOnce(pendingDecision);

    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "APROVAR" }));
    await waitFor(() => expect(server.reviewAffiliateApplication).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();

    await act(async () => {
      resolveDecision({ ok: true, emailSent: false });
    });
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(screen.queryByText("Inscrição aprovada.")).not.toBeInTheDocument();
    expect(server.getAffiliateApplications).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
  });

  it("opens global uncertain mail triage with a database-backed filter and can clear it", async () => {
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    const uncertain = screen.getByRole("button", { name: "Ver notificações: incertos" });
    fireEvent.click(uncertain);
    await waitFor(() =>
      expect(server.getAffiliateApplications).toHaveBeenLastCalledWith({
        data: { status: "todas", page: 0, search: undefined, mailStatus: "incerto" },
      }),
    );
    expect(uncertain).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(uncertain);
    await waitFor(() =>
      expect(server.getAffiliateApplications).toHaveBeenLastCalledWith({
        data: { status: "todas", page: 0, search: undefined, mailStatus: null },
      }),
    );
    expect(uncertain).toHaveAttribute("aria-pressed", "false");
  });

  it("does not display any applicant data before the session check succeeds", async () => {
    server.getAffiliateAdminSession.mockResolvedValue({ authenticated: false });
    render(<Page />);
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(server.getAffiliateApplications).not.toHaveBeenCalled();
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
  });
});
