import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
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
  requestAffiliateAccessEmail: service.requestAffiliateAccessEmail,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  vonixAffiliateAuth: {
    auth: {
      getUser: service.getUser,
      onAuthStateChange: service.onAuthStateChange,
      signOut: service.signOut,
      verifyOtp: service.verifyOtp,
    },
    from: service.from,
  },
}));

import { AffiliateApplicationTracker } from "@/routes/acompanhar-inscricao";

type Status = "pendente" | "aprovada" | "recusada";
function answer(status: Status) {
  return {
    data: [
      {
        application_id: "example-only",
        status,
        rejection_reason: status === "recusada" ? "seguidores_insuficientes" : null,
        submitted_at: "2026-11-11T12:00:00Z",
        reviewed_at: null,
      },
    ],
    error: null,
  };
}
function identity(email: string) {
  return { data: { user: { email, email_confirmed_at: "2026-11-11T12:00:00Z" } }, error: null };
}
function deferred<T>() {
  let resolve!: (data: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
let authChanged: (() => void) | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  authChanged = undefined;
  service.onAuthStateChange.mockImplementation((callback: () => void) => {
    authChanged = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  service.signOut.mockResolvedValue({ error: null });
  service.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Legacy affiliate applicant tracker session consistency", () => {
  it("must not display a previous account's delayed private status under the next verified identity", async () => {
    const previousStatus = deferred<ReturnType<typeof answer>>();
    service.getUser
      .mockResolvedValueOnce(identity("first@example.invalid"))
      .mockResolvedValueOnce(identity("second@example.invalid"));
    service.from
      .mockImplementationOnce(() => ({
        select: () => ({ order: () => ({ limit: () => previousStatus.promise }) }),
      }))
      .mockImplementationOnce(() => ({
        select: () => ({ order: () => ({ limit: async () => answer("pendente") }) }),
      }));
    render(<AffiliateApplicationTracker />);
    await waitFor(() => expect(service.from).toHaveBeenCalledTimes(1));
    await act(async () => {
      authChanged?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText("second@example.invalid")).toBeInTheDocument());
    expect(screen.getByText("Candidatura em análise")).toBeInTheDocument();
    await act(async () => {
      previousStatus.resolve(answer("recusada"));
      await previousStatus.promise;
    });
    expect(screen.getByText("second@example.invalid")).toBeInTheDocument();
    expect(screen.getByText("Candidatura em análise")).toBeInTheDocument();
    expect(screen.queryByText("Candidatura não selecionada")).not.toBeInTheDocument();
  });

  it("must ignore an obsolete delayed getUser response after the user has signed out", async () => {
    const previousUser = deferred<ReturnType<typeof identity>>();
    service.getUser
      .mockImplementationOnce(() => previousUser.promise)
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    render(<AffiliateApplicationTracker />);
    await waitFor(() => expect(service.getUser).toHaveBeenCalledTimes(1));
    await act(async () => {
      authChanged?.();
      await Promise.resolve();
    });
    await screen.findByLabelText("E-mail utilizado na inscrição");
    await act(async () => {
      previousUser.resolve(identity("old@example.invalid"));
      await previousUser.promise;
    });
    expect(screen.getByLabelText("E-mail utilizado na inscrição")).toBeInTheDocument();
    expect(screen.queryByText("old@example.invalid")).not.toBeInTheDocument();
    expect(service.from).not.toHaveBeenCalled();
  });
});

describe("Session logout and disposal", () => {
  it("does not claim logout succeeded when Auth rejects it and rechecks the same verified account", async () => {
    service.getUser.mockResolvedValue(identity("verified@example.invalid"));
    service.from.mockImplementation(() => ({
      select: () => ({ order: () => ({ limit: async () => answer("pendente") }) }),
    }));
    service.signOut.mockResolvedValue({ error: { message: "cannot revoke" } });
    render(<AffiliateApplicationTracker />);
    await screen.findByText("Candidatura em análise");
    expect(screen.getByText("verified@example.invalid")).toBeInTheDocument();
    await act(async () => {
      screen.getByRole("button", { name: "Sair" }).click();
    });
    await screen.findByText("verified@example.invalid");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível encerrar sua sessão",
    );
    expect(service.getUser).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Candidatura em análise")).toBeInTheDocument();
  });

  it("does not start a new Auth request from a queued callback after unmount", async () => {
    const delayedUser = deferred<ReturnType<typeof identity>>();
    service.getUser.mockReturnValueOnce(delayedUser.promise);
    const { unmount } = render(<AffiliateApplicationTracker />);
    await waitFor(() => expect(service.getUser).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => {
      authChanged?.();
      await Promise.resolve();
    });
    await act(async () => {
      delayedUser.resolve(identity("after@example.invalid"));
      await delayedUser.promise;
    });
    expect(service.getUser).toHaveBeenCalledTimes(1);
    expect(service.from).not.toHaveBeenCalled();
  });
});
