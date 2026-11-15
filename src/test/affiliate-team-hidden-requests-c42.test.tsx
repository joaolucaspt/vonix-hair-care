import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
  loginAffiliateAdminMember: mocks.login,
  requestAffiliateAccessEmail: mocks.request,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const email = "synthetic.owner@example.invalid";

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
});

describe("C42 private team recovery after interrupted provider requests", () => {
  it("C47 sends at most one team access email for same-tick duplicate form submits", async () => {
    const pending = deferred<{ status: "requested" }>();
    mocks.request.mockReturnValue(pending.promise);
    render(<AffiliateTeamAccess />);
    fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
      target: { value: email },
    });
    const form = screen.getByRole("button", { name: "Enviar acesso por e-mail" }).closest("form");
    expect(form).not.toBeNull();
    act(() => {
      fireEvent.submit(form!);
      fireEvent.submit(form!);
    });
    expect(mocks.request).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve({ status: "requested" });
      await pending.promise;
    });
    expect(screen.getByRole("status")).toHaveTextContent("Se seu e-mail está autorizado");
  });

  it("C47 lets corrected email retry immediately, ignoring an older pending provider reply", async () => {
    const older = deferred<{ status: "rate-limited" }>();
    const fresh = deferred<{ status: "requested" }>();
    mocks.request.mockReturnValueOnce(older.promise).mockReturnValueOnce(fresh.promise);
    render(<AffiliateTeamAccess />);
    const field = await screen.findByLabelText("E-mail autorizado");
    fireEvent.change(field, { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce());
    fireEvent.change(field, { target: { value: "another.owner@example.invalid" } });
    const button = screen.getByRole("button", { name: "Enviar acesso por e-mail" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    await act(async () => {
      older.resolve({ status: "rate-limited" });
      await older.promise;
    });
    expect(screen.getByRole("button", { name: "Verificando..." })).toBeDisabled();
    expect(
      screen.queryByText("Limite temporário de solicitações. Tente novamente mais tarde."),
    ).not.toBeInTheDocument();
    await act(async () => {
      fresh.resolve({ status: "requested" });
      await fresh.promise;
    });
    expect(screen.getByRole("status")).toHaveTextContent("Se seu e-mail está autorizado");
    expect(screen.getByRole("button", { name: "Enviar acesso por e-mail" })).toBeEnabled();
  });

  it("unlocks a fresh email request on resume without letting an older completion unlock a newer request", async () => {
    const oldRequest = deferred<{ status: "requested" }>();
    const newRequest = deferred<{ status: "requested" }>();
    mocks.request.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
      await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      spy.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      const button = screen.getByRole("button", { name: "Enviar acesso por e-mail" });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
      await act(async () => {
        oldRequest.resolve({ status: "requested" });
        await oldRequest.promise;
      });
      expect(screen.getByRole("button", { name: "Verificando..." })).toBeDisabled();
      expect(
        screen.queryByText(/Se seu e-mail está autorizado, solicitamos o acesso/),
      ).not.toBeInTheDocument();
      await act(async () => {
        newRequest.resolve({ status: "requested" });
        await newRequest.promise;
      });
      expect(
        await screen.findByText(/Se seu e-mail está autorizado, solicitamos o acesso/),
      ).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it("unlocks the OTP verification after backgrounding a provider call that never settles", async () => {
    const oldCode = deferred<{ error: { message: string } }>();
    mocks.verifyOtp.mockReturnValueOnce(oldCode.promise).mockResolvedValueOnce({
      error: { message: "synthetic expired" },
      data: {},
    });
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    try {
      render(<AffiliateTeamAccess />);
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Validar" }));
      await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledOnce());
      spy.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      spy.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
        target: { value: email },
      });
      fireEvent.change(screen.getByLabelText("Código recebido, se disponível"), {
        target: { value: "654321" },
      });
      expect(screen.getByRole("button", { name: "Validar" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Validar" }));
      await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole("alert")).toHaveTextContent("Código inválido ou expirado.");
    } finally {
      spy.mockRestore();
    }
  });
});
