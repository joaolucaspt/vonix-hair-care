import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const server = vi.hoisted(() => ({ getAffiliateStatusByCode: vi.fn() }));
vi.mock("@/lib/affiliate-functions", () => ({
  getAffiliateStatusByCode: server.getAffiliateStatusByCode,
}));
vi.mock("@/components/affiliate-shell", () => ({
  AffiliateShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { component: React.ComponentType }) => config,
}));

import { AffiliateTrackingCodePage } from "@/routes/consultar-candidatura";

const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.sessionStorage.removeItem("vonix-affiliate-once-code");
});

describe("Private Vonix email-less applicant status portal", () => {
  it("consumes one-time code from signup and auto-consults without URL leakage", async () => {
    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    window.sessionStorage.setItem("vonix-affiliate-once-code", code);
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: true,
      status: "pendente",
      rejectionReason: null,
      submittedAt: "2026-11-11T12:00:00Z",
      reviewedAt: null,
    });
    render(<AffiliateTrackingCodePage />);
    await waitFor(() =>
      expect(server.getAffiliateStatusByCode).toHaveBeenCalledWith({ data: { code } }),
    );
    expect(await screen.findByText("Candidatura em análise")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vonix-affiliate-once-code")).toBeNull();
    expect(window.location.search).not.toContain(code);
    expect(window.location.hash).not.toContain(code);
    expect(screen.getByRole("button", { name: "Copiar código para guardar" })).toBeInTheDocument();
  });

  it("allows copying the private code on the status portal without persisting or logging it in the URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(window.navigator, "clipboard");
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      render(<AffiliateTrackingCodePage />);
      fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
        target: { value: code },
      });
      fireEvent.click(screen.getByRole("button", { name: "Copiar código para guardar" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(code));
      expect(screen.getByRole("button", { name: "Código copiado!" })).toBeInTheDocument();
      expect(window.location.search).not.toContain(code);
      expect(window.location.hash).not.toContain(code);
      expect(server.getAffiliateStatusByCode).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(window.navigator, "clipboard", original);
      else Reflect.deleteProperty(window.navigator, "clipboard");
    }
  });

  it("requires a strong private code, not a social handle", () => {
    render(<AffiliateTrackingCodePage />);
    expect(screen.getByRole("button", { name: "Consultar minha inscrição" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: "@instagram-aberto" },
    });
    expect(screen.getByRole("button", { name: "Consultar minha inscrição" })).toBeDisabled();
    expect(server.getAffiliateStatusByCode).not.toHaveBeenCalled();
  });

  it("shows objective follower reason and possibility of retrying after rejection", async () => {
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: true,
      status: "recusada",
      rejectionReason: "seguidores_insuficientes",
      submittedAt: "2026-11-11T12:00:00Z",
      reviewedAt: "2026-11-11T13:00:00Z",
    });
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    await waitFor(() =>
      expect(server.getAffiliateStatusByCode).toHaveBeenCalledWith({
        data: { code },
      }),
    );
    expect(await screen.findByText(/Poucos seguidores no Instagram/)).toBeInTheDocument();
    expect(screen.getByText(/quantidade de seguidores considerada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quero me candidatar novamente" })).toHaveAttribute(
      "href",
      "/seja-afiliada",
    );
    expect(document.body.innerHTML).not.toContain("e-mail da candidata");
  });

  it("rejects invalid codes without exposing candidate data", async () => {
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: false,
      reason: "Código não encontrado. Confira e tente novamente.",
    });
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Código não encontrado");
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument();
  });
});
