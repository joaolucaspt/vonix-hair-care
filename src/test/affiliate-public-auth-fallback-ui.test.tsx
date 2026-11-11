import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  request: vi.fn(),
  login: vi.fn(),
  getUser: vi.fn(),
  stateChanged: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
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
  requestAffiliateAccessEmail: deps.request,
  loginAffiliateAdminMember: deps.login,
}));
vi.mock("@/lib/vonix-affiliate-auth", () => ({
  affiliateAuthInitialLinkRecoveryReason: null,
  vonixAffiliateAuth: {
    auth: {
      getUser: deps.getUser,
      onAuthStateChange: deps.stateChanged,
      signInWithOtp: deps.signInWithOtp,
      verifyOtp: deps.verifyOtp,
      signOut: deps.signOut,
    },
  },
}));

import { AffiliateTeamAccess } from "@/routes/acesso-equipe-afiliadas";
import { AffiliateApplicationTracker } from "@/routes/acompanhar-inscricao";

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  deps.getUser.mockResolvedValue({ data: { user: null }, error: null });
  deps.stateChanged.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  deps.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  deps.request.mockResolvedValue({ status: "not-configured" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Vonix affiliate public auth fallback is server-only and roster-scoped", () => {
  it("never provisions a new Auth identity from owner e-mail form on provider outage", async () => {
    render(<AffiliateTeamAccess />);
    const field = await screen.findByLabelText("E-mail autorizado");
    fireEvent.change(field, { target: { value: "pending.owner@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Envio temporariamente indisponível",
    );
    expect(deps.request).toHaveBeenCalledWith({
      data: { email: "pending.owner@example.invalid", purpose: "owner" },
    });
    expect(deps.signInWithOtp).not.toHaveBeenCalled();
  });

  it("never requests direct client Auth OTP for a historical applicant on outage", async () => {
    render(<AffiliateApplicationTracker />);
    const field = await screen.findByLabelText("E-mail utilizado na inscrição");
    fireEvent.change(field, { target: { value: "candidate@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Receber acesso por e-mail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporariamente indisponível");
    expect(deps.request).toHaveBeenCalledWith({
      data: { email: "candidate@example.invalid", purpose: "applicant" },
    });
    expect(deps.signInWithOtp).not.toHaveBeenCalled();
  });

  it("still shows the standard neutral acknowledgement after an owner mail request", async () => {
    deps.request.mockResolvedValue({ status: "requested" });
    render(<AffiliateTeamAccess />);
    fireEvent.change(await screen.findByLabelText("E-mail autorizado"), {
      target: { value: "pending.owner@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar acesso por e-mail" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Se seu e-mail está autorizado"),
    );
    expect(deps.signInWithOtp).not.toHaveBeenCalled();
  });
});
