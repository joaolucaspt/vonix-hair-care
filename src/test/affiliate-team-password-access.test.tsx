import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginAffiliateAdminMember: vi.fn(),
  requestAffiliateAccessEmail: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  from: vi.fn(),
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
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";

beforeEach(() => {
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.loginAffiliateAdminMember.mockResolvedValue({
    ok: false,
    reason: "Acesso não autorizado. Verifique o e-mail, a senha pessoal e sua permissão de equipe.",
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  cleanup();
  vi.restoreAllMocks();
});

describe("Vonix affiliate already-activated owner password sign-in", () => {
  it("requires a human click before redeeming a private owner-shared link", async () => {
    const hash = "a".repeat(64);
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas#vonix_invite=" + hash);
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: { message: "expired" } });
    render(<AffiliateTeamAccess />);
    const confirm = await screen.findByRole("button", { name: "Confirmar ativação" });
    expect(window.location.hash).toBe("");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: hash, type: "magiclink" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("expirou");
  });

  it("requires a new personal password after manually verifying the one-use hash", async () => {
    const hash = "b".repeat(64);
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas#vonix_invite=" + hash);
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          email: "pending.owner@example.invalid",
          email_confirmed_at: "2026-11-10T22:00:00Z",
        },
      },
      error: null,
    });
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: "owner", password_set_at: null },
            error: null,
          }),
        }),
      }),
    });
    render(<AffiliateTeamAccess />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar ativação" }));
    expect(
      await screen.findByRole("heading", { name: "Crie sua senha pessoal" }),
    ).toBeInTheDocument();
    expect(mocks.loginAffiliateAdminMember).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("opens the administrator shortcut directly on personal password sign-in", async () => {
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas?login=senha");
    render(<AffiliateTeamAccess />);
    expect(
      await screen.findByRole("heading", { name: "Entrar com senha pessoal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "E-mail administrativo" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar acesso por e-mail" }),
    ).not.toBeInTheDocument();
    expect(mocks.requestAffiliateAccessEmail).not.toHaveBeenCalled();
    expect(mocks.loginAffiliateAdminMember).not.toHaveBeenCalled();
  });

  it("offers direct password sign-in without requesting a new OTP", async () => {
    render(<AffiliateTeamAccess />);
    fireEvent.click(await screen.findByRole("button", { name: /Já tenho senha/ }));
    const emailInput = screen.getByRole("textbox", { name: "E-mail administrativo" });
    const passwordInput = screen.getByLabelText("Senha pessoal");
    expect(emailInput).toBeRequired();
    expect(passwordInput).toHaveAttribute("minlength", "12");
    expect(mocks.requestAffiliateAccessEmail).not.toHaveBeenCalled();

    fireEvent.change(emailInput, { target: { value: " OWNER@EXAMPLE.INVALID " } });
    fireEvent.change(passwordInput, { target: { value: "SecretPersonalPassword2026!" } });
    fireEvent.click(screen.getByRole("button", { name: /Acessar candidaturas/ }));
    await waitFor(() =>
      expect(mocks.loginAffiliateAdminMember).toHaveBeenCalledWith({
        data: { email: "owner@example.invalid", password: "SecretPersonalPassword2026!" },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Acesso não autorizado.");
    expect(mocks.requestAffiliateAccessEmail).not.toHaveBeenCalled();
  });

  it("returns to secure invitation enrollment without losing access to the OTP form", async () => {
    render(<AffiliateTeamAccess />);
    fireEvent.click(await screen.findByRole("button", { name: /Já tenho senha/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Ainda não tenho senha ou preciso recuperar acesso/ }),
    );
    expect(screen.getByRole("button", { name: "Enviar acesso por e-mail" })).toBeInTheDocument();
    expect(screen.getByLabelText("Código recebido, se disponível")).toBeInTheDocument();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not make a password grant with an incomplete password", async () => {
    render(<AffiliateTeamAccess />);
    fireEvent.click(await screen.findByRole("button", { name: /Já tenho senha/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail administrativo" }), {
      target: { value: "owner@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Senha pessoal"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /Acessar candidaturas/ }));
    expect(mocks.loginAffiliateAdminMember).not.toHaveBeenCalled();
  });
});
