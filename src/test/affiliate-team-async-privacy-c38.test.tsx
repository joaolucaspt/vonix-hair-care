import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  from: vi.fn(),
  login: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/affiliate-functions", () => ({
  loginAffiliateAdminMember: m.login,
  requestAffiliateAccessEmail: m.request,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  affiliateAuthInitialLinkRecoveryReason: null,
  vonixAffiliateAuth: {
    auth: {
      getUser: m.getUser,
      onAuthStateChange: m.onAuthStateChange,
      signOut: m.signOut,
      verifyOtp: m.verifyOtp,
    },
    from: m.from,
  },
}));
import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";
const email = "owner@example.invalid";
const password = "Secure-Synthetic-Password-2026!";
function pending<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  m.getUser.mockResolvedValue({ data: { user: null }, error: null });
  m.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("C38 affiliate access - asynchronous privacy boundaries", () => {
  it("does not claim an old email request was sent for a newly entered identity", async () => {
    const p = pending<{ status: "requested" }>();
    m.request.mockReturnValueOnce(p.promise);
    render(<AffiliateTeamAccess />);
    const field = await screen.findByLabelText("E-mail autorizado");
    fireEvent.change(field, { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
    await waitFor(() => expect(m.request).toHaveBeenCalledOnce());
    fireEvent.change(field, { target: { value: "another@example.invalid" } });
    await act(async () => {
      p.resolve({ status: "requested" });
      await p.promise;
    });
    expect(
      screen.queryByText(/Se seu e-mail está autorizado, solicitamos o acesso/),
    ).not.toBeInTheDocument();
    expect(field).toHaveValue("another@example.invalid");
  });

  it("does not restore an old delivery notice after the tab is backgrounded", async () => {
    const p = pending<{ status: "requested" }>();
    m.request.mockReturnValueOnce(p.promise);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
      await waitFor(() => expect(m.request).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        p.resolve({ status: "requested" });
        await p.promise;
      });
      expect(
        screen.queryByText(/Se seu e-mail está autorizado, solicitamos o acesso/),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });

  it("does not show an obsolete password-login error after tab hide", async () => {
    const p = pending<{ ok: false; reason: string }>();
    m.login.mockReturnValueOnce(p.promise);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.click(await screen.findByRole("button", { name: /Já tenho senha/ }));
      fireEvent.change(screen.getByLabelText("E-mail administrativo"), {
        target: { value: email },
      });
      fireEvent.change(screen.getByLabelText("Senha pessoal"), { target: { value: password } });
      fireEvent.click(screen.getByRole("button", { name: /Acessar candidaturas/ }));
      await waitFor(() => expect(m.login).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        p.resolve({ ok: false, reason: "Acesso não autorizado." });
        await p.promise;
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });

  it("does not show an obsolete OTP network error after tab hide", async () => {
    const p = pending<never>();
    m.verifyOtp.mockReturnValueOnce(p.promise);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Validar" }));
      await waitFor(() => expect(m.verifyOtp).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        p.resolve(undefined as never);
        await p.promise;
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });
});
