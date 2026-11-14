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
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
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

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
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
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
});

describe("C39 private team OTP and invitation replay safety", () => {
  it("does not display a stale network error after an OTP request rejects in a hidden tab", async () => {
    const pending = deferred<never>();
    m.verifyOtp.mockReturnValueOnce(pending.promise);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: "member.one@example.invalid" },
      });
      fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Validar" }));
      await waitFor(() => expect(m.verifyOtp).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        pending.reject(new Error("synthetic offline"));
        try {
          await pending.promise;
        } catch {
          /* synthetic rejection expected */
        }
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });

  it("does not revalidate an obsolete OTP when the applicant changes the team email", async () => {
    const pending = deferred<{ data: object; error: null }>();
    m.verifyOtp.mockReturnValueOnce(pending.promise);
    render(<AffiliateTeamAccess />);
    const field = await screen.findByLabelText("E-mail autorizado");
    fireEvent.change(field, { target: { value: "owner.old@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validar" }));
    await waitFor(() => expect(m.verifyOtp).toHaveBeenCalledOnce());
    fireEvent.change(field, { target: { value: "owner.new@example.invalid" } });
    await act(async () => {
      pending.resolve({ data: {}, error: null });
      await pending.promise;
    });
    expect(m.getUser).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("owner.new@example.invalid");
    expect(screen.getByRole("heading", { name: "Confirmar e-mail da equipe" })).toBeInTheDocument();
  });

  it("does not surface a stale private invitation error after hiding the tab mid-verification", async () => {
    const hash = "k".repeat(64);
    window.history.replaceState({}, "", "/acesso-equipe-afiliadas#vonix_invite=" + hash);
    const pending = deferred<never>();
    m.verifyOtp.mockReturnValueOnce(pending.promise);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.click(await screen.findByRole("button", { name: "Confirmar ativação" }));
      await waitFor(() => expect(m.verifyOtp).toHaveBeenCalledOnce());
      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        pending.reject(new Error("synthetic provider disconnect"));
        try {
          await pending.promise;
        } catch {
          /* synthetic rejection expected */
        }
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      visibility.mockRestore();
    }
  });
});
