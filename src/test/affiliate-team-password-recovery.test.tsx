import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  verifyOtp: vi.fn(),
  from: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  loginAffiliateAdminMember: vi.fn(),
  requestAffiliateAccessEmail: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (c: { component: React.ComponentType }) => c,
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
      verifyOtp: mocks.verifyOtp,
      signOut: mocks.signOut,
      updateUser: mocks.updateUser,
    },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));
import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";

const verified = {
  data: { user: { email: "owner@example.invalid", email_confirmed_at: "2026-11-11T20:00:00Z" } },
  error: null,
};
const signedOut = { data: { user: null }, error: null };
beforeEach(() => {
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  vi.resetAllMocks();
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.getUser.mockResolvedValue(signedOut);
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { role: "owner", password_set_at: "2026-11-11T18:00:00Z" },
          error: null,
        }),
      }),
    }),
  });
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.loginAffiliateAdminMember.mockResolvedValue({
    ok: false,
    reason: "Synthetic login denied",
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
});

describe("Verified existing-owner password recovery", () => {
  it("never opens a password reset from a pre-existing authenticated browser session", async () => {
    mocks.getUser.mockResolvedValue(verified);
    render(<AffiliateTeamAccess />);
    expect(await screen.findByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Redefinir sua senha pessoal" }),
    ).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("offers a personal password reset only after fresh one-time email verification", async () => {
    mocks.getUser.mockResolvedValueOnce(signedOut).mockResolvedValue(verified);
    render(<AffiliateTeamAccess />);
    expect(
      await screen.findByRole("heading", { name: "Confirmar e-mail da equipe" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail autorizado"), {
      target: { value: "owner@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validar" }));
    expect(
      await screen.findByRole("heading", { name: "Redefinir sua senha pessoal" }),
    ).toBeInTheDocument();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "owner@example.invalid",
      token: "123456",
      type: "email",
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "AnotherStrongPersonalPassword-2026" },
    });
    fireEvent.change(screen.getByLabelText("Confirme a senha"), {
      target: { value: "AnotherStrongPersonalPassword-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir senha e acessar" }));
    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        password: "AnotherStrongPersonalPassword-2026",
      }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.loginAffiliateAdminMember).toHaveBeenCalledWith({
      data: { email: "owner@example.invalid", password: "AnotherStrongPersonalPassword-2026" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("senha foi atualizada");
  });

  it("never opens a reset form if Supabase rejects the submitted OTP", async () => {
    mocks.verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: "expired" } });
    render(<AffiliateTeamAccess />);
    await screen.findByRole("heading", { name: "Confirmar e-mail da equipe" });
    fireEvent.change(screen.getByLabelText("E-mail autorizado"), {
      target: { value: "owner@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou expirado.");
    expect(
      screen.queryByRole("heading", { name: "Redefinir sua senha pessoal" }),
    ).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
