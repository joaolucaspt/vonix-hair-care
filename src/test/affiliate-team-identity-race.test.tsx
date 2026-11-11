import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  loginAffiliateAdminMember: vi.fn(),
  requestAffiliateAccessEmail: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/affiliate-functions", () => ({
  loginAffiliateAdminMember: mocked.loginAffiliateAdminMember,
  requestAffiliateAccessEmail: mocked.requestAffiliateAccessEmail,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  affiliateAuthInitialLinkRecoveryReason: null,
  vonixAffiliateAuth: {
    auth: {
      getUser: mocked.getUser,
      onAuthStateChange: mocked.onAuthStateChange,
      signOut: mocked.signOut,
      verifyOtp: mocked.verifyOtp,
    },
    from: mocked.from,
  },
}));
import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => (resolve = accept));
  return { promise, resolve };
}
function identity(email: string) {
  return { data: { user: { email, email_confirmed_at: "2026-11-11T11:00:00Z" } }, error: null };
}
function roster(passwordSet: boolean) {
  return {
    data: { role: "owner", password_set_at: passwordSet ? "2026-11-11T11:00:00Z" : null },
    error: null,
  };
}
let authChanged: (() => void) | undefined;
let unsubscribed: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
  vi.resetAllMocks();
  unsubscribed = vi.fn();
  authChanged = undefined;
  mocked.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocked.onAuthStateChange.mockImplementation((callback: () => void) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe: unsubscribed } } };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/acesso-equipe-afiliadas");
});

describe("Vonix affiliate team identity consistency", () => {
  it("does not restore first owner's onboarding state after a newer owner has signed in", async () => {
    const oldRoster = deferred<ReturnType<typeof roster>>();
    mocked.getUser
      .mockResolvedValueOnce(identity("first@example.invalid"))
      .mockResolvedValueOnce(identity("second@example.invalid"));
    mocked.from
      .mockImplementationOnce(() => ({
        select: () => ({ eq: () => ({ maybeSingle: () => oldRoster.promise }) }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => roster(true) }) }),
      }));
    render(<AffiliateTeamAccess />);
    await waitFor(() => expect(mocked.from).toHaveBeenCalledTimes(1));
    await act(async () => {
      authChanged?.();
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    expect(mocked.getUser).toHaveBeenCalledTimes(2);
    await act(async () => {
      oldRoster.resolve(roster(false));
      await oldRoster.promise;
    });
    expect(screen.getByRole("heading", { name: "Entrar na gestão" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Crie sua senha pessoal" }),
    ).not.toBeInTheDocument();
  });

  it("ignores an obsolete verified getUser after the current account becomes signed out", async () => {
    const firstUser = deferred<ReturnType<typeof identity>>();
    mocked.getUser
      .mockImplementationOnce(() => firstUser.promise)
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    mocked.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => roster(false) }) }),
    });
    render(<AffiliateTeamAccess />);
    await waitFor(() => expect(mocked.getUser).toHaveBeenCalledTimes(1));
    await act(async () => {
      authChanged?.();
      await Promise.resolve();
    });
    expect(await screen.findByLabelText("E-mail autorizado")).toBeInTheDocument();
    await act(async () => {
      firstUser.resolve(identity("stale@example.invalid"));
      await firstUser.promise;
    });
    expect(screen.getByLabelText("E-mail autorizado")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Crie sua senha pessoal" }),
    ).not.toBeInTheDocument();
    expect(mocked.from).not.toHaveBeenCalled();
  });

  it("does not trigger another auth lookup from a queued callback after unmount", async () => {
    const user = deferred<ReturnType<typeof identity>>();
    mocked.getUser.mockReturnValueOnce(user.promise);
    const { unmount } = render(<AffiliateTeamAccess />);
    await waitFor(() => expect(mocked.getUser).toHaveBeenCalledTimes(1));
    await act(async () => {
      authChanged?.();
      unmount();
      await Promise.resolve();
    });
    await act(async () => {
      user.resolve(identity("gone@example.invalid"));
      await user.promise;
    });
    expect(mocked.getUser).toHaveBeenCalledTimes(1);
    expect(mocked.from).not.toHaveBeenCalled();
    expect(unsubscribed).toHaveBeenCalledTimes(1);
  });
});
