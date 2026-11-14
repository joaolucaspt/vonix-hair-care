import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
          data: {
            role: "owner",
            password_set_at: "2026-11-11T12:00:00Z",
            ever_activated_at: "2026-11-11T12:00:00Z",
          },
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

  it("C42 rechecks the current identity when tab resumes before a prior sign-out completes", async () => {
    let resolveSignOut!: (value: { error: null }) => void;
    mocks.signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      expect(await screen.findByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Trocar e-mail ou recuperar acesso" }));
      await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(mocks.getUser).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
      await act(async () => {
        resolveSignOut({ error: null });
        await Promise.resolve();
      });
      expect(screen.getByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
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
