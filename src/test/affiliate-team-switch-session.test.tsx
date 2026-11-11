import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  verifyOtp: vi.fn(),
  loginAffiliateAdminMember: vi.fn(),
  requestAffiliateAccessEmail: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/affiliate-functions", () => ({
  loginAffiliateAdminMember: mocks.loginAffiliateAdminMember,
  requestAffiliateAccessEmail: mocks.requestAffiliateAccessEmail,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  affiliateAuthInitialLinkRecoveryReason: null,
  vonixAffiliateAuth: {
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
      verifyOtp: mocks.verifyOtp,
    },
    from: mocks.from,
  },
}));

import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  mocks.getUser.mockResolvedValue({
    data: { user: { email: "owner@example.invalid", email_confirmed_at: "2026-11-11T12:00:00Z" } },
    error: null,
  });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { role: "owner", password_set_at: "2026-11-11T12:00:00Z" },
          error: null,
        }),
      }),
    }),
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Vonix affiliate team safe account switching", () => {
  it("does not pretend the owner signed out when the provider refuses signOut", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: { message: "network blocked" } });
    render(<AffiliateTeamAccess />);
    expect(await screen.findByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trocar e-mail ou recuperar acesso" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível encerrar");
    expect(screen.getByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Confirmar e-mail da equipe" }),
    ).not.toBeInTheDocument();
  });

  it("does not claim another account is available when denied-owner signOut fails", async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }));
    mocks.signOut.mockRejectedValueOnce(new TypeError("connection down"));
    render(<AffiliateTeamAccess />);
    expect(
      await screen.findByRole("heading", { name: "Acesso não autorizado" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair e tentar outra conta" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Não foi possível encerrar sua sessão/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acesso não autorizado" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Confirmar e-mail da equipe" }),
    ).not.toBeInTheDocument();
  });

  it("clears the previous identity only after confirmed signOut", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: null });
    render(<AffiliateTeamAccess />);
    expect(await screen.findByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trocar e-mail ou recuperar acesso" }));
    expect(
      await screen.findByRole("heading", { name: "Confirmar e-mail da equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail autorizado")).toHaveValue("");
    expect(screen.queryByText("owner@example.invalid")).not.toBeInTheDocument();
  });
});
