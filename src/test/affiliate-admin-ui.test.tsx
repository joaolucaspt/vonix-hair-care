import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  getAffiliateAdminSession: vi.fn(),
  getAffiliateApplications: vi.fn(),
  loginAffiliateAdmin: vi.fn(),
  logoutAffiliateAdmin: vi.fn(),
  reviewAffiliateApplication: vi.fn(),
  eraseAffiliateApplicationAdmin: vi.fn(),
  getAffiliateOperationalReadiness: vi.fn(),
  getAffiliateRetentionPreview: vi.fn(),
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
  server.eraseAffiliateApplicationAdmin.mockResolvedValue({ ok: true });
  server.getAffiliateOperationalReadiness.mockResolvedValue({
    ok: true,
    recruitmentOpen: false,
    databaseResponding: true,
    governanceResponding: false,
    checks: [{ id: "migration", label: "Migração de governança atestada", ok: false }],
  });
  server.getAffiliateApplications.mockResolvedValue(list());
  server.getAffiliateRetentionPreview.mockResolvedValue({
    ok: true,
    pendingEligible: 5,
    rejectedEligible: 9,
    executedDeletions: 0,
  });
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

  it("mostra o diagnóstico privado sem expor segredos", async () => {
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verificar preparação" }));
    expect(await screen.findByText("Migração de governança atestada")).toBeInTheDocument();
    expect(screen.getByText("As inscrições permanecem bloqueadas.")).toBeInTheDocument();
    expect(server.getAffiliateOperationalReadiness).toHaveBeenCalledOnce();
  });

  it("shows only aggregate, read-only retention counts to authenticated administrators", async () => {
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    expect(server.getAffiliateRetentionPreview).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Pendentes há pelo menos/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/Recusadas há pelo menos/i), {
      target: { value: "240" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar prévia" }));
    await waitFor(() =>
      expect(server.getAffiliateRetentionPreview).toHaveBeenCalledWith({
        data: { pendingDays: 120, rejectedDays: 240 },
      }),
    );
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText(/Exclusões executadas por esta consulta: 0/)).toBeInTheDocument();
    expect(server.eraseAffiliateApplicationAdmin).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Pendentes há pelo menos/i), {
      target: { value: "121" },
    });
    expect(screen.queryByText(/Exclusões executadas por esta consulta: 0/)).not.toBeInTheDocument();
  });

  it("does not restore a stale retention preview after administrator logout", async () => {
    let finish!: (value: {
      ok: true;
      pendingEligible: number;
      rejectedEligible: number;
      executedDeletions: number;
    }) => void;
    const delayed = new Promise<{
      ok: true;
      pendingEligible: number;
      rejectedEligible: number;
      executedDeletions: number;
    }>((resolve) => {
      finish = resolve;
    });
    server.getAffiliateRetentionPreview.mockReturnValueOnce(delayed);
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar prévia" }));
    await waitFor(() => expect(server.getAffiliateRetentionPreview).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await act(async () => {
      finish({ ok: true, pendingEligible: 42, rejectedEligible: 11, executedDeletions: 0 });
    });
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(screen.queryByText("Prévia de retenção LGPD")).not.toBeInTheDocument();
    expect(screen.queryByText(/Exclusões executadas por esta consulta/)).not.toBeInTheDocument();
  });

  it("does not link untrusted social profiles supplied by stored applications", async () => {
    server.getAffiliateApplications.mockResolvedValueOnce(
      list([
        {
          ...candidate,
          instagram_url: "https://someone:password@instagram.com/qa",
          tiktok_url: "https://tiktok.com/@qa?redirect=https://evil.invalid",
        },
      ]),
    );
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /TikTok/i })).not.toBeInTheDocument();
  });

  it("requires exact email confirmation before a candidate can be erased", async () => {
    render(<Page />);
    expect(await screen.findByText("Segredo da candidata")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Exclusão de dados/i }));
    const destructive = screen.getByRole("button", { name: /Confirmar exclusão definitiva/i });
    expect(destructive).toBeDisabled();
    const confirmation = screen.getByLabelText(/Confirme digitando o e-mail da candidata/i);
    fireEvent.change(confirmation, { target: { value: "wrong@example.com" } });
    expect(destructive).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: "secret-candidate@example.invalid" } });
    expect(destructive).toBeEnabled();
    fireEvent.click(destructive);
    await waitFor(() =>
      expect(server.eraseAffiliateApplicationAdmin).toHaveBeenCalledWith({
        data: {
          id: candidate.id,
          emailConfirmation: candidate.email,
          reason: "solicitacao_titular",
        },
      }),
    );
    expect(screen.queryByText("Exclusão irreversível da candidatura")).not.toBeInTheDocument();
  });

  it("does not display any applicant data before the session check succeeds", async () => {
    server.getAffiliateAdminSession.mockResolvedValue({ authenticated: false });
    render(<Page />);
    expect(await screen.findByText("Acesso da equipe")).toBeInTheDocument();
    expect(server.getAffiliateApplications).not.toHaveBeenCalled();
    expect(screen.queryByText("Segredo da candidata")).not.toBeInTheDocument();
    expect(screen.queryByText("Prévia de retenção LGPD")).not.toBeInTheDocument();
  });
});
