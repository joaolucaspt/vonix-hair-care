import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const server = vi.hoisted(() => ({ submit: vi.fn() }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));
const receipts = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("@/lib/affiliate-private-receipt", () => ({
  downloadAffiliatePrivateReceipt: receipts.download,
}));
vi.mock("@/lib/analytics", () => ({ track: analytics.track }));
vi.mock("@/lib/affiliate-functions", () => ({
  submitSimpleAffiliateApplication: server.submit,
}));
import { AffiliateSimpleForm } from "@/components/affiliate-simple-form";

beforeEach(() => {
  vi.resetAllMocks();
  server.submit.mockImplementation(async (args: { data: { trackingCode?: string } }) => ({
    ok: true,
    trackingCode: args.data.trackingCode,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.sessionStorage.removeItem("vonix-affiliate-unconfirmed-code");
  window.sessionStorage.removeItem("vonix-affiliate-once-code");
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
  it("confirma declaração explícita de maioridade sem coletar data de nascimento", () => {
    render(<AffiliateSimpleForm />);
    const confirmation = screen.getByRole("checkbox", { name: /Autorizo o uso destes dados/ });
    expect(confirmation).toBeRequired();
    expect(confirmation.closest("label")).toHaveTextContent("Declaro ter 18 anos ou mais");
    expect(document.querySelector('input[name="birthDate"]')).toBeNull();
  });

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
    server.submit.mockImplementation(async (args: { data: { trackingCode?: string } }) => ({
      ok: true,
      trackingCode: args.data.trackingCode,
    }));
    render(<AffiliateSimpleForm />);
    expect(screen.queryByLabelText("Código privado de acompanhamento")).not.toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    const receipt = await screen.findByLabelText("Código privado de acompanhamento");
    expect((receipt as HTMLInputElement).value).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(server.submit.mock.calls[0]![0].data.trackingCode).toBe(
      (receipt as HTMLInputElement).value,
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

  it("keeps an unconfirmed private code when the network loses a committed response, then retries exactly once", async () => {
    let calls = 0;
    server.submit.mockImplementation(async (args: { data: { trackingCode?: string } }) => {
      calls++;
      if (calls === 1) throw new TypeError("response lost after database commit");
      return { ok: true, trackingCode: args.data.trackingCode };
    });
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    const privateInput = await screen.findByLabelText("Código privado da tentativa não confirmada");
    const pendingCode = (privateInput as HTMLInputElement).value;
    expect(pendingCode).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(window.sessionStorage.getItem("vonix-affiliate-unconfirmed-code")).toBe(pendingCode);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível confirmar o envio");
    expect(analytics.track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    const confirmed = await screen.findByLabelText("Código privado de acompanhamento");
    expect(confirmed).toHaveValue(pendingCode);
    expect(server.submit).toHaveBeenCalledTimes(2);
    expect(server.submit.mock.calls[0]![0].data.trackingCode).toBe(pendingCode);
    expect(server.submit.mock.calls[1]![0].data.trackingCode).toBe(pendingCode);
    expect(window.sessionStorage.getItem("vonix-affiliate-unconfirmed-code")).toBeNull();
    expect(analytics.track).toHaveBeenCalledExactlyOnceWith("sign_up", {
      method: "affiliate_application",
    });
  });

  it("recovers a pending code after browser reload without claiming any enrollment was accepted", async () => {
    server.submit.mockRejectedValue(new TypeError("network lost"));
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    const codeBefore = (
      (await screen.findByLabelText(
        "Código privado da tentativa não confirmada",
      )) as HTMLInputElement
    ).value;
    cleanup();
    render(<AffiliateSimpleForm />);
    const codeAfter = (
      (await screen.findByLabelText(
        "Código privado da tentativa não confirmada",
      )) as HTMLInputElement
    ).value;
    expect(codeAfter).toBe(codeBefore);
    expect(screen.getByText(/Este código não comprova que ela foi salva/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar código no portal" })).toHaveAttribute(
      "href",
      "/consultar-candidatura",
    );
    // The status portal receives the private code via a one-time same-tab
    // handoff, never as a URL query, referrer, or analytics event.
    const link = screen.getByRole("link", { name: "Consultar código no portal" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(window.sessionStorage.getItem("vonix-affiliate-once-code")).toBe(codeBefore);
    expect(window.sessionStorage.getItem("vonix-affiliate-unconfirmed-code")).toBe(codeBefore);
    expect(link.getAttribute("href")).not.toContain(codeBefore);
    expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it("does not report a Meta Lead if the server returns another private code", async () => {
    server.submit.mockResolvedValue({ ok: true, trackingCode: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef" });
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(
      await screen.findByLabelText("Código privado da tentativa não confirmada"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível confirmar o recebimento");
    expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
    expect(analytics.track).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Descartar código e iniciar nova tentativa" }),
    );
    expect(
      screen.queryByLabelText("Código privado da tentativa não confirmada"),
    ).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("vonix-affiliate-unconfirmed-code")).toBeNull();
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

  it("accepts shared official Instagram and TikTok profile links with tracking query parameters", async () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.change(screen.getByLabelText(/^Instagram/), {
      target: { value: "https://www.instagram.com/maria.exemplo/?igsh=YWIxMTEx" },
    });
    fireEvent.change(screen.getByLabelText(/^TikTok/), {
      target: { value: "https://www.tiktok.com/@maria.exemplo?_t=8xYz&_r=1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    await waitFor(() =>
      expect(server.submit).toHaveBeenCalledWith({
        data: expect.objectContaining({
          instagram: "maria.exemplo",
          tiktok: "maria.exemplo",
        }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Inscrição recebida!");
  });

  it("rejects spoofed social domains and non-profile paths despite tracking query strings", async () => {
    render(<AffiliateSimpleForm />);
    fill();
    fireEvent.change(screen.getByLabelText(/^Instagram/), {
      target: { value: "https://instagram.com.evil.io/maria?igsh=x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
    expect(server.submit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um usuário válido");
  });

  it("clears only CEP-autofilled address fields on postal code change, preserving manual edits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          logradouro: "Rua Primeira",
          bairro: "Centro Antigo",
          localidade: "Belo Horizonte",
          uf: "MG",
        }),
      ),
    );
    render(<AffiliateSimpleForm />);
    fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "30110012" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));
    expect(await screen.findByDisplayValue("Rua Primeira")).toBeInTheDocument();
    expect(screen.getByLabelText(/Bairro/)).toHaveValue("Centro Antigo");
    fireEvent.change(screen.getByLabelText(/Rua \/ Avenida/), {
      target: { value: "Rua digitada por mim" },
    });
    fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "30120020" } });
    expect(screen.getByLabelText(/Rua \/ Avenida/)).toHaveValue("Rua digitada por mim");
    expect(screen.getByLabelText(/Bairro/)).toHaveValue("");
    expect(screen.getByLabelText(/Cidade/)).toHaveValue("");
    expect(screen.getByLabelText(/Estado/)).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));
    await waitFor(() => expect(screen.getByLabelText(/Bairro/)).toHaveValue("Centro Antigo"));
    expect(screen.getByLabelText(/Rua \/ Avenida/)).toHaveValue("Rua digitada por mim");
  });

  it("unlocks lookup after CEP changes mid-flight; stale reply must not overwrite current address", async () => {
    let releaseOld!: (reply: Response) => void;
    const first = new Promise<Response>((resolve) => {
      releaseOld = resolve;
    });
    const provider = vi.fn((url: string) => {
      if (url.includes("/30110012/")) return first;
      return Promise.resolve(
        Response.json({
          logradouro: "Rua do Segundo CEP",
          bairro: "Bairro Atual",
          localidade: "Contagem",
          uf: "MG",
        }),
      );
    });
    vi.stubGlobal("fetch", provider);
    render(<AffiliateSimpleForm />);
    fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "30110012" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));
    await waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Buscando CEP..." })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/CEP/), { target: { value: "32010000" } });
    expect(screen.getByRole("button", { name: "Buscar CEP" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));
    await waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue("Rua do Segundo CEP")).toBeInTheDocument();

    releaseOld(
      Response.json({
        logradouro: "Rua Antiga",
        bairro: "Antigo",
        localidade: "Cidade Antiga",
        uf: "RJ",
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Buscar CEP" })).toBeEnabled());
    expect(screen.getByLabelText(/Rua \/ Avenida/)).toHaveValue("Rua do Segundo CEP");
    expect(screen.getByLabelText(/Cidade/)).toHaveValue("Contagem");
    expect(screen.getByLabelText(/Estado/)).toHaveValue("MG");
  });
});

it("keeps the confirmed receipt visible when sessionStorage blocks direct status handoff", async () => {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "vonix-affiliate-once-code")
      throw new DOMException("storage blocked", "SecurityError");
    return original.call(this, key, value);
  });
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const receipt = await screen.findByLabelText("Código privado de acompanhamento");
  const code = (receipt as HTMLInputElement).value;
  fireEvent.click(screen.getByRole("button", { name: "Acompanhar inscrição agora" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Copie e guarde o código antes de abrir o acompanhamento",
  );
  expect(receipt).toHaveValue(code);
  expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  expect(window.location.pathname).not.toBe("/consultar-candidatura");
});

it("does not abandon an unconfirmed private receipt if browser storage refuses the status handoff", async () => {
  server.submit.mockRejectedValueOnce(new TypeError("connection interrupted"));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "vonix-affiliate-once-code") throw new DOMException("blocked", "SecurityError");
    return original.call(this, key, value);
  });
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const field = await screen.findByLabelText("Código privado da tentativa não confirmada");
  const code = (field as HTMLInputElement).value;
  const link = screen.getByRole("link", { name: "Consultar código no portal" });
  const click = fireEvent.click(link);
  expect(click).toBe(false);
  expect(await screen.findByText(/Copie e guarde o código da tentativa/)).toBeInTheDocument();
  expect(field).toHaveValue(code);
  expect(window.sessionStorage.getItem("vonix-affiliate-unconfirmed-code")).toBe(code);
  expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
  expect(analytics.track).not.toHaveBeenCalled();
});

it("stops navigation when storage silently drops an unconfirmed receipt", async () => {
  server.submit.mockRejectedValueOnce(new TypeError("upstream unavailable"));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "vonix-affiliate-once-code") return;
    return original.call(this, key, value);
  });
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const code = await screen.findByLabelText("Código privado da tentativa não confirmada");
  expect(fireEvent.click(screen.getByRole("link", { name: "Consultar código no portal" }))).toBe(
    false,
  );
  expect(await screen.findByText(/Copie e guarde o código da tentativa/)).toBeInTheDocument();
  expect(code).toHaveValue((code as HTMLInputElement).value);
  expect(analytics.track).not.toHaveBeenCalled();
});

it("offers a download of a confirmed code without sending another application or Meta Lead", async () => {
  receipts.download.mockReturnValueOnce(true);
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const code = (
    (await screen.findByLabelText("Código privado de acompanhamento")) as HTMLInputElement
  ).value;
  fireEvent.click(screen.getByRole("button", { name: "Baixar código de acompanhamento" }));
  expect(receipts.download).toHaveBeenCalledExactlyOnceWith(code, true);
  expect(screen.getByText(/Download solicitado/)).toBeInTheDocument();
  expect(server.submit).toHaveBeenCalledOnce();
  expect(analytics.track).toHaveBeenCalledOnce();
});

it("allows local backup for an unconfirmed attempt without falsely claiming enrollment", async () => {
  server.submit.mockRejectedValueOnce(new TypeError("response lost"));
  receipts.download.mockReturnValueOnce(true);
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const code = (
    (await screen.findByLabelText("Código privado da tentativa não confirmada")) as HTMLInputElement
  ).value;
  fireEvent.click(screen.getByRole("button", { name: "Baixar código de tentativa" }));
  expect(receipts.download).toHaveBeenCalledExactlyOnceWith(code, false);
  expect(screen.getByText(/Download solicitado/)).toBeInTheDocument();
  expect(screen.queryByText("Inscrição recebida!")).not.toBeInTheDocument();
  expect(analytics.track).not.toHaveBeenCalled();
  expect(server.submit).toHaveBeenCalledOnce();
});

it("keeps the tracking code visible if the browser blocks its backup download", async () => {
  receipts.download.mockReturnValueOnce(false);
  render(<AffiliateSimpleForm />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Enviar minha inscrição" }));
  const input = await screen.findByLabelText("Código privado de acompanhamento");
  const code = (input as HTMLInputElement).value;
  fireEvent.click(screen.getByRole("button", { name: "Baixar código de acompanhamento" }));
  expect(screen.getByText(/Este navegador não permitiu baixar o arquivo/)).toBeInTheDocument();
  expect(input).toHaveValue(code);
});
