import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
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
  it("masks the private receipt by default and only reveals it on explicit request", () => {
    render(<AffiliateTrackingCodePage />);
    const field = screen.getByLabelText("Código privado de acompanhamento");
    fireEvent.change(field, { target: { value: code } });
    expect(field).toHaveAttribute("type", "password");
    const reveal = screen.getByRole("button", { name: "Mostrar código privado" });
    expect(reveal).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(reveal);
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar código privado" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocultar código privado" }));
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveValue(code);
  });

  it("hides sensitive lookup status on tab background without deleting the saved code", async () => {
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: true,
      status: "aprovada",
      rejectionReason: null,
      submittedAt: "2026-11-11T12:00:00Z",
      reviewedAt: "2026-11-11T13:00:00Z",
    });
    render(<AffiliateTrackingCodePage />);
    const field = screen.getByLabelText("Código privado de acompanhamento");
    fireEvent.change(field, { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(await screen.findByText("Candidatura aprovada")).toBeInTheDocument();
    let state: DocumentVisibilityState = "hidden";
    const spy = vi.spyOn(document, "visibilityState", "get").mockImplementation(() => state);
    try {
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
      expect(field).toHaveValue(code);
      expect(field).toHaveAttribute("type", "password");
      state = "visible";
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
      expect(server.getAffiliateStatusByCode).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("ignores an in-flight private status response after its tab becomes hidden", async () => {
    let finish!: (result: unknown) => void;
    server.getAffiliateStatusByCode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(screen.getByRole("button", { name: "Consultando..." })).toBeDisabled();
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await act(async () => {
        finish({
          ok: true,
          status: "aprovada",
          rejectionReason: null,
          submittedAt: "2026-11-11T12:00:00Z",
          reviewedAt: null,
        });
        await Promise.resolve();
      });
      expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Consultar minha inscrição" })).toBeEnabled();
    } finally {
      spy.mockRestore();
    }
  });

  it("does not initiate private auto-lookup from a one-time code on an initially hidden tab", async () => {
    window.sessionStorage.setItem("vonix-affiliate-once-code", code);
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      render(<AffiliateTrackingCodePage />);
      await waitFor(() =>
        expect(screen.getByLabelText("Código privado de acompanhamento")).toHaveValue(code),
      );
      expect(server.getAffiliateStatusByCode).not.toHaveBeenCalled();
      expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
      expect(window.sessionStorage.getItem("vonix-affiliate-once-code")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("ignores private status responses completed while the document is hidden even before a visibility event", async () => {
    let resolve!: (value: unknown) => void;
    server.getAffiliateStatusByCode.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      await act(async () => {
        resolve({
          ok: true,
          status: "aprovada",
          rejectionReason: null,
          submittedAt: "2026-11-11T12:00:00Z",
          reviewedAt: null,
        });
        await Promise.resolve();
      });
      expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

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

  it("never displays a stale rejected result for code A after code B was submitted", async () => {
    const codeB = "abcdefghijklmnopqrstuvwxABCDEFGH";
    let releaseOld!: (result: unknown) => void;
    const oldReply = new Promise((resolve) => {
      releaseOld = resolve;
    });
    server.getAffiliateStatusByCode
      .mockImplementationOnce(() => oldReply)
      .mockResolvedValueOnce({
        ok: true,
        status: "pendente",
        rejectionReason: null,
        submittedAt: "2026-11-11T12:00:00Z",
        reviewedAt: null,
      });
    render(<AffiliateTrackingCodePage />);
    const field = screen.getByLabelText("Código privado de acompanhamento");
    fireEvent.change(field, { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(screen.getByRole("button", { name: "Consultando..." })).toBeDisabled();
    fireEvent.change(field, { target: { value: codeB } });
    expect(screen.getByRole("button", { name: "Consultar minha inscrição" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(await screen.findByText("Candidatura em análise")).toBeInTheDocument();
    await act(async () => {
      releaseOld({
        ok: true,
        status: "recusada",
        rejectionReason: "seguidores_insuficientes",
        submittedAt: "2026-11-11T11:00:00Z",
        reviewedAt: "2026-11-11T11:20:00Z",
      });
      await Promise.resolve();
    });
    expect(field).toHaveValue(codeB);
    expect(screen.getByText("Candidatura em análise")).toBeInTheDocument();
    expect(screen.queryByText("Candidatura não selecionada")).not.toBeInTheDocument();
    expect(server.getAffiliateStatusByCode).toHaveBeenCalledTimes(2);
  });

  it("drops a stale network error when the code changes before lookup finishes", async () => {
    let rejectOld!: (error: Error) => void;
    server.getAffiliateStatusByCode.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOld = reject;
        }),
    );
    render(<AffiliateTrackingCodePage />);
    const field = screen.getByLabelText("Código privado de acompanhamento");
    fireEvent.change(field, { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    fireEvent.change(field, { target: { value: "12345678901234567890123456789012" } });
    await act(async () => {
      rejectOld(new Error("stale offline reply"));
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consultar minha inscrição" })).toBeEnabled();
  });

  it("does not publish a network error after the document becomes hidden without a visibility event", async () => {
    let reject!: (error: Error) => void;
    server.getAffiliateStatusByCode.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    await waitFor(() => expect(server.getAffiliateStatusByCode).toHaveBeenCalledOnce());
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      await act(async () => {
        reject(new Error("synthetic network lost"));
        await Promise.resolve();
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it("does not show Invalid Date or an approval for an invalid date returned by an outdated client contract", async () => {
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: true,
      status: "aprovada",
      rejectionReason: null,
      submittedAt: "not-an-ISO-timestamp",
      reviewedAt: null,
    });
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/validar os dados/i);
    expect(screen.queryByText("Candidatura aprovada")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Invalid Date");
  });

  it("fails closed on an unrecognized private status instead of silently showing 'em análise'", async () => {
    server.getAffiliateStatusByCode.mockResolvedValue({
      ok: true,
      status: "estado_desconhecido",
      rejectionReason: null,
      submittedAt: "2026-11-11T12:00:00Z",
      reviewedAt: null,
    });
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    fireEvent.click(screen.getByRole("button", { name: "Consultar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/validar os dados/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

// C37 regression: private clipboard actions must be single-flight, even if React
// has not yet committed the disabled state on rapid repeated user gestures.
it("C37 refuses duplicate private status-code clipboard writes while pending", async () => {
  let resolveCopy!: () => void;
  const pending = new Promise<void>((resolve) => {
    resolveCopy = resolve;
  });
  const writeText = vi.fn().mockReturnValue(pending);
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    render(<AffiliateTrackingCodePage />);
    fireEvent.change(screen.getByLabelText("Código privado de acompanhamento"), {
      target: { value: code },
    });
    const copy = screen.getByRole("button", { name: "Copiar código para guardar" });
    fireEvent.click(copy);
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(copy).toBeDisabled();
    await act(async () => {
      resolveCopy();
      await pending;
    });
    expect(screen.getByRole("button", { name: "Código copiado!" })).toBeInTheDocument();
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("C37 never selects a secret field if clipboard fails while tab is hidden before the event", async () => {
  let rejectCopy!: (reason: Error) => void;
  const writeText = vi.fn().mockReturnValue(
    new Promise<void>((_, reject) => {
      rejectCopy = reject;
    }),
  );
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  try {
    render(<AffiliateTrackingCodePage />);
    const field = screen.getByLabelText("Código privado de acompanhamento") as HTMLInputElement;
    fireEvent.change(field, { target: { value: code } });
    const select = vi.spyOn(field, "select");
    const focus = vi.spyOn(field, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Copiar código para guardar" }));
    expect(writeText).toHaveBeenCalledOnce();
    visibility.mockReturnValue("hidden");
    await act(async () => {
      rejectCopy(new Error("synthetic permission denied"));
      await Promise.resolve();
    });
    expect(select).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: "Código copiado!" })).not.toBeInTheDocument();
  } finally {
    visibility.mockRestore();
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
