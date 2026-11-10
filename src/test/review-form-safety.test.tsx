import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitReview: vi.fn(),
  track: vi.fn(),
  addSummary: vi.fn(),
}));
vi.mock("@/lib/reviews.functions", () => ({ submitReview: mocks.submitReview }));
vi.mock("@/lib/analytics", () => ({ track: mocks.track }));
vi.mock("@/lib/review-summary", () => ({ addToSummary: mocks.addSummary }));
vi.mock("@/components/share-button", () => ({
  ShareButton: () => <button type="button">Compartilhar produto</button>,
}));

import { ReviewForm } from "@/components/review-form";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem("vonix-avaliou");
  mocks.submitReview.mockResolvedValue({ ok: true, publicada: false, review: null });
});
afterEach(() => {
  cleanup();
  localStorage.removeItem("vonix-avaliou");
});

function prepareForm() {
  fireEvent.click(screen.getByRole("radio", { name: "5 estrelas" }));
  fireEvent.change(screen.getByPlaceholderText("Como você quer aparecer"), {
    target: { value: "Visitante Teste" },
  });
  fireEvent.change(screen.getByPlaceholderText("O que você achou? Como foi o resultado?"), {
    target: { value: "Gostei bastante da textura e do aroma." },
  });
}

describe("formulário de avaliação no catálogo", () => {
  it("não herda uma avaliação enviada ao navegar para outro produto na mesma rota SPA", async () => {
    const view = render(<ReviewForm slug="kit-banana-e-mel" productName="Kit Banana" />);
    prepareForm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByText(/Avaliação enviada, obrigado/)).toBeInTheDocument();

    view.rerender(<ReviewForm slug="kit-cafe-verde" productName="Kit Café" />);
    expect(await screen.findByRole("form", { name: "Avaliar Kit Café" })).toBeInTheDocument();
    expect(screen.queryByText(/Avaliação enviada, obrigado/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Como você quer aparecer")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "5 estrelas" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(mocks.submitReview).toHaveBeenCalledTimes(1);
  });

  it("impede duas submissões concorrentes mesmo se o formulário receber submit duplicado", async () => {
    let resolve!: (response: { ok: true; publicada: false; review: null }) => void;
    mocks.submitReview.mockImplementationOnce(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );
    render(<ReviewForm slug="kit-banana-e-mel" productName="Kit Banana" />);
    prepareForm();
    const form = screen.getByRole("form", { name: "Avaliar Kit Banana" });
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(mocks.submitReview).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, publicada: false, review: null }));
    expect(await screen.findByText(/Avaliação enviada, obrigado/)).toBeInTheDocument();
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("ignora confirmação antiga de outro produto após navegação durante o envio", async () => {
    let finish!: (response: { ok: true; publicada: false; review: null }) => void;
    mocks.submitReview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<ReviewForm slug="kit-banana-e-mel" productName="Kit Banana" />);
    prepareForm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();

    view.rerender(<ReviewForm slug="kit-cafe-verde" productName="Kit Café" />);
    expect(await screen.findByRole("form", { name: "Avaliar Kit Café" })).toBeInTheDocument();
    await act(async () => finish({ ok: true, publicada: false, review: null }));
    expect(screen.getByRole("form", { name: "Avaliar Kit Café" })).toBeInTheDocument();
    expect(screen.queryByText(/Avaliação enviada, obrigado/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Como você quer aparecer")).toHaveValue("");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("após falha de gravação, permite nova tentativa sem manter bloqueio de envio", async () => {
    mocks.submitReview
      .mockResolvedValueOnce({ ok: false, motivo: "Servidor ocupado" })
      .mockResolvedValueOnce({ ok: true, publicada: false, review: null });
    render(<ReviewForm slug="kit-banana-e-mel" productName="Kit Banana" />);
    prepareForm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Servidor ocupado");
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByText(/Avaliação enviada, obrigado/)).toBeInTheDocument();
    expect(mocks.submitReview).toHaveBeenCalledTimes(2);
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("não confirma avaliação quando o serviço rejeita a gravação", async () => {
    mocks.submitReview.mockResolvedValueOnce({
      ok: false,
      motivo: "Avaliações temporariamente indisponíveis.",
    });
    render(<ReviewForm slug="kit-banana-e-mel" productName="Kit Banana" />);
    prepareForm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar avaliação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/temporariamente indisponíveis/);
    expect(screen.queryByText(/Avaliação enviada, obrigado/)).not.toBeInTheDocument();
    expect(localStorage.getItem("vonix-avaliou")).toBeNull();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
