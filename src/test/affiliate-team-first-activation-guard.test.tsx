import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  loginAffiliateAdminMember: vi.fn(),
  requestAffiliateAccessEmail: vi.fn(),
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
      updateUser: mocks.updateUser,
    },
    from: mocks.from,
    rpc: mocks.rpc,
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

const invitedEmail = "new.owner@example.invalid";
const user = { email: invitedEmail, email_confirmed_at: "2026-11-12T12:00:00Z" };
const invite = { role: "owner", password_set_at: null, ever_activated_at: null };
const revoked = { ...invite, ever_activated_at: "2026-11-12T20:00:00Z" };
const noUser = { data: { user: null }, error: null };
const yesUser = { data: { user }, error: null };

function mockInvite(lookup: () => Promise<unknown>) {
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: lookup }) }),
  });
}

beforeEach(() => {
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(noUser);
  mocks.verifyOtp.mockResolvedValue({ error: null, data: {} });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null, data: true });
  mocks.loginAffiliateAdminMember.mockResolvedValue({
    ok: false,
    reason: "Synthetic test login denied",
  });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockInvite(async () => ({ data: invite, error: null }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
});

async function verifyFreshOtp() {
  render(<AffiliateTeamAccess />);
  const field = await screen.findByRole("textbox", { name: "E-mail autorizado" });
  fireEvent.change(field, { target: { value: invitedEmail } });
  fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Validar" }));
  await screen.findByRole("heading", { name: "Crie sua senha pessoal" });
}

function submitFirstPassword() {
  fireEvent.change(screen.getByLabelText("Nova senha"), {
    target: { value: "SyntheticNewPassword2026!" },
  });
  fireEvent.change(screen.getByLabelText("Confirme a senha"), {
    target: { value: "SyntheticNewPassword2026!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ativar acesso seguro" }));
}

describe("Current invite and fresh Auth identity mandatory for first admin activation", () => {
  it("does not offer first activation merely because an old Auth session matches an invite", async () => {
    mocks.getUser.mockResolvedValue(yesUser);
    render(<AffiliateTeamAccess />);
    await screen.findByRole("heading", { name: "Confirmar e-mail da equipe" });
    expect(
      screen.queryByRole("heading", { name: "Crie sua senha pessoal" }),
    ).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a revoked former owner after fresh OTP without offering first activation", async () => {
    mocks.getUser.mockResolvedValueOnce(noUser).mockResolvedValue(yesUser);
    mockInvite(async () => ({ data: revoked, error: null }));
    render(<AffiliateTeamAccess />);
    fireEvent.change(await screen.findByRole("textbox", { name: "E-mail autorizado" }), {
      target: { value: invitedEmail },
    });
    fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validar" }));
    expect(
      await screen.findByRole("heading", { name: "Acesso não autorizado" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Crie sua senha pessoal" }),
    ).not.toBeInTheDocument();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("refuses to change Auth password when pending invite is revoked after OTP proof", async () => {
    mocks.getUser.mockResolvedValueOnce(noUser).mockResolvedValue(yesUser);
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ data: invite, error: null })
      .mockResolvedValueOnce({ data: revoked, error: null });
    mockInvite(lookup);
    await verifyFreshOtp();
    submitFirstPassword();
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("blocks changing Auth password when invite is withdrawn after OTP validation", async () => {
    mocks.getUser.mockResolvedValueOnce(noUser).mockResolvedValue(yesUser);
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ data: invite, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockInvite(lookup);
    await verifyFreshOtp();
    submitFirstPassword();
    await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível concluir a ativação/i,
    );
  });

  it("blocks password changes if the Auth user switches after the one-time proof", async () => {
    mocks.getUser
      .mockResolvedValueOnce(noUser)
      .mockResolvedValueOnce(yesUser)
      .mockResolvedValue({
        data: {
          user: { email: "other@example.invalid", email_confirmed_at: "2026-11-12T12:00:00Z" },
        },
        error: null,
      });
    await verifyFreshOtp();
    submitFirstPassword();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível concluir a ativação/i,
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("C42 does not exchange an administrative password grant from a completed activation after tab hide", async () => {
    let releaseMark!: (value: { error: null; data: true }) => void;
    mocks.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseMark = resolve;
      }),
    );
    mocks.getUser.mockResolvedValueOnce(noUser).mockResolvedValue(yesUser);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      await verifyFreshOtp();
      submitFirstPassword();
      await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        releaseMark({ error: null, data: true });
        await Promise.resolve();
      });
      expect(mocks.loginAffiliateAdminMember).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Sua senha pessoal foi criada e o convite administrativo foi ativado."),
      ).not.toBeInTheDocument();
      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(mocks.loginAffiliateAdminMember).not.toHaveBeenCalled();
    } finally {
      visibility.mockRestore();
    }
  });

  it("allows a verified pending invite to set its own password after a fresh identity and roster check", async () => {
    mocks.getUser.mockResolvedValueOnce(noUser).mockResolvedValue(yesUser);
    const lookup = vi.fn(async () => ({ data: invite, error: null }));
    mockInvite(lookup);
    await verifyFreshOtp();
    submitFirstPassword();
    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: "SyntheticNewPassword2026!" }),
    );
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).toHaveBeenCalledWith("vonix_affiliate_activate_admin_account");
    await waitFor(() => expect(mocks.loginAffiliateAdminMember).toHaveBeenCalledOnce());
  });
});
