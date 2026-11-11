import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const server = vi.hoisted(() => ({ submit: vi.fn() }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track: analytics.track }));
vi.mock("@/lib/affiliate-functions", () => ({
  submitSimpleAffiliateApplication: server.submit,
}));
import { AffiliateSimpleForm } from "@/components/affiliate-simple-form";

beforeEach(() => {
  vi.resetAllMocks();
  server.submit.mockResolvedValue({ ok: true, trackingCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fill() {
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: "Maria da Silva" } });
  fireEvent.change(screen.getByLabelText(/Telefone com DDD/), {
    target: { value: "(31) 99999-9999" },
  });
  fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "30110012" } });
  fireEvent.change(screen.getByLabelText(/Rua \/ Avenida/), { target: { value: "Rua da Bahia" } });
  fireEvent.change(screen.getByLabelText(/Número/), { target: { value: "150" } });
  fireEvent.change(screen.getByLabelText(/Bairro/), { target: { value: "Centro" } });
  fireEvent.change(screen.getByLabelText(/Cidade/), { target: { value: "Belo Horizonte" } });
  fireEvent.change(screen.getByLabelText(/Estado/), { target: { value: "MG" } });
  fireEvent.change(screen.getByLabelText(/^Instagram/), { target: { value: "@maria.exemplo" } });
  fireEvent.change(screen.getByLabelText(/Seguidores no Instagram/), {
    target: { value: "12345" },
  });
  fireEvent.change(screen.getByLabelText(/^TikTok/), { target: { value: "@maria.exemplo" } });
  fireEvent.change(screen.getByLabelText(/Seguidores no TikTok/), { target: { value: "4300" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo o uso destes dados/ }));
}

describe("Vonix short single-page application form", () => {
  it("shows ONLY requested questions plus legal data protection consent", () => {
    render(<AffiliateSimpleForm />);
    expect(screen.getByText("Endereço completo")).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone com DDD/)).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText(/Telefone com DDD/)).toBeRequired();
    expect(screen.getByLabelText(/CEP/)).toBeRequired();
    expect(screen.getByLabelText(/Número/)).toBeRequired();
    expect(screen.getByLabelText(/^Instagram/)).toBeRequired();
    expect(screen.getByLabelText(/Seguidores no Instagram/)).toBeRequired();
    expect(screen.getByLabelText(/^TikTok/)).not.toBeRequired();
    expect(screen.getByLabelText(/Seguidores no TikTok/)).not.toBeRequired();
    for (const removed of [
      "CPF",
      "CNPJ",
      "Nascimento",
      "Qual é seu nicho",
      "Motivação",
      "E-mail",
      "Tipo de cabelo",
      "Cupom",
      "Dependentes",
    ]) {
      expect(screen.queryByLabelText(new RegExp(removed, "i"))).not.toBeInTheDocument();
    }
  });

  it("submits a minimal payload with required followers and complete address", async () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    await waitFor(() => expect(server.submit).toHaveBeenCalledOnce());
    expect(server.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: "Maria da Silva",
        number: "150",
        postalCode: "30110-012",
        instagram: "maria.exemplo",
        instagramFollowers: 12345,
        tiktok: "maria.exemplo",
        tiktokFollowers: 4300,
        privacyAccepted: true,
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Inscrição recebida!");
    expect(analytics.track).toHaveBeenCalledExactlyOnceWith("sign_up", {
      method: "affiliate_application",
    });
  });

  it("displays a private tracking code only after successful server receipt", async () => {
    server.submit.mockResolvedValue({ ok: true, trackingCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef" });
    render(<AffiliateSimpleForm />);
    expect(screen.queryByLabelText("Código privado de acompanhamento")).not.toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(await screen.findByLabelText("Código privado de acompanhamento")).toHaveValue(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef",
    );
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acompanhar inscrição agora" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "vonixhair.com/consultar-candidatura" }),
    ).toHaveAttribute("href", "/consultar-candidatura");
  });

  it("submits successfully with both TikTok fields left empty", async () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.change(screen.getByLabelText(/^TikTok/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/Seguidores no TikTok/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    await waitFor(() => expect(server.submit).toHaveBeenCalledOnce());
    expect(server.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instagram: "maria.exemplo",
        instagramFollowers: 12345,
        tiktok: "",
        tiktokFollowers: null,
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Inscrição recebida!");
    expect(analytics.track).toHaveBeenCalledExactlyOnceWith("sign_up", {
      method: "affiliate_application",
    });
  });

  it("never confirms a honeypot/non-persisted acknowledgement as a Meta Lead", async () => {
    server.submit.mockResolvedValue({ ok: true });
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível confirmar o recebimento",
    );
    expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("rejects an invalid-length receipt without sending conversion events", async () => {
    server.submit.mockResolvedValue({ ok: true, trackingCode: "incomplete" });
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar");
    expect(analytics.track).not.toHaveBeenCalled();
    expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
  });

  it("submits a valid s/n street number instead of falsely rejecting Brazilian addresses", async () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.change(screen.getByLabelText(/Número/), { target: { value: "s/n" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    await waitFor(() =>
      expect(server.submit).toHaveBeenCalledWith({
        data: expect.objectContaining({ number: "s/n" }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Inscrição recebida");
  });

  it("keeps an interactive preview from calling the server", async () => {
    render(<AffiliateSimpleForm preview />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Simular envio" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("apenas uma prévia"));
    expect(server.submit).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("never reports a lead when the server rejects a candidature", async () => {
    server.submit.mockResolvedValue({ ok: false, reason: "Inscrições indisponíveis." });
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Inscrições indisponíveis.");
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("rejects a missing address number before any request", () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.change(screen.getByLabelText(/Número/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(server.submit).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});
