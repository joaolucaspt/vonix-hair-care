import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/affiliate-functions", () => ({
  submitAffiliateApplication: api.submit,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    target,
    rel,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    target?: string;
    rel?: string;
    "aria-label"?: string;
  }) => (
    <a href="/politica-de-privacidade" target={target} rel={rel} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

import { AffiliateWizard } from "@/components/affiliate-wizard";

function field(name: string, value: string) {
  const control = document.getElementById("wizard-" + name) as HTMLInputElement | HTMLSelectElement;
  if (!control) throw new Error("Missing wizard control: " + name);
  fireEvent.change(control, { target: { value } });
}

function next() {
  fireEvent.click(screen.getByRole("button", { name: /Avançar/i }));
}

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Vonix five-stage browser wizard", () => {
  it("requires step one personal data and validates identity before advancing", () => {
    render(<AffiliateWizard preview />);
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    next();
    expect(screen.getByText(/Informe seu primeiro nome/)).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
  });

  it("notifies the parent only whether an unsent draft exists, never its contents", () => {
    const onDraftChange = vi.fn();
    render(<AffiliateWizard preview onDraftChange={onDraftChange} />);
    expect(onDraftChange).toHaveBeenLastCalledWith(false);
    field("firstName", "Nome privado sintético");
    expect(onDraftChange).toHaveBeenLastCalledWith(true);
    expect(JSON.stringify(onDraftChange.mock.calls)).not.toContain("Nome privado sintético");
    fireEvent.click(screen.getByRole("button", { name: "Limpar meus dados" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar dados" }));
    expect(onDraftChange).toHaveBeenLastCalledWith(false);
  });

  it("warns before leaving with an unsent draft, but not after discarding it", () => {
    render(<AffiliateWizard preview />);
    const emptyExit = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(emptyExit);
    expect(emptyExit.defaultPrevented).toBe(false);

    field("firstName", "Marina");
    const draftedExit = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(draftedExit);
    expect(draftedExit.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Limpar meus dados" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar dados" }));
    const discardedExit = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(discardedExit);
    expect(discardedExit.defaultPrevented).toBe(false);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("requires confirmation before discarding a private draft", async () => {
    render(<AffiliateWizard preview />);
    expect(screen.queryByRole("button", { name: "Limpar meus dados" })).not.toBeInTheDocument();
    field("firstName", "Marina");
    field("email", "marina@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Limpar meus dados" }));
    expect(screen.getByText("Descartar todos os dados digitados?")).toBeInTheDocument();
    const advance = screen.getByRole("button", { name: /Avançar/i });
    expect(advance).toBeDisabled();
    fireEvent.submit(advance.closest("form")!);
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar preenchendo" }));
    expect((document.getElementById("wizard-firstName") as HTMLInputElement).value).toBe("Marina");
    expect((document.getElementById("wizard-email") as HTMLInputElement).value).toBe(
      "marina@example.com",
    );
    fireEvent.click(screen.getByRole("button", { name: "Limpar meus dados" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar dados" }));
    expect((document.getElementById("wizard-firstName") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("wizard-email") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Os dados deste formulário foram descartados.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar meus dados" })).not.toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("does not let an outstanding postal-code request repopulate discarded data", async () => {
    let completeLookup: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            completeLookup = resolve;
          }),
      ),
    );
    render(<AffiliateWizard />);
    field("postalCode", "30110012");
    fireEvent.blur(document.getElementById("wizard-postalCode")!);
    fireEvent.click(screen.getByRole("button", { name: "Limpar meus dados" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar dados" }));
    await act(async () => {
      completeLookup?.(
        Response.json({
          localidade: "Cidade Antiga",
          uf: "MG",
          logradouro: "Rua Antiga",
          bairro: "Bairro Antigo",
        }),
      );
    });
    expect((document.getElementById("wizard-postalCode") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("wizard-city") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("wizard-street") as HTMLInputElement).value).toBe("");
  });

  it("keeps progress and blocks any real submission during a public preview", () => {
    render(<AffiliateWizard preview />);
    field("firstName", "Marina");
    field("lastName", "Exemplo");
    field("phone", "31999999999");
    field("email", "marina@example.com");
    field("emailConfirmation", "marina@example.com");
    field("cpf", "52998224725");
    field("birthDate", "1998-09-14");
    field("birthCity", "Belo Horizonte");
    field("postalCode", "30110012");
    field("city", "Belo Horizonte");
    field("state", "MG");
    field("street", "Rua da Bahia");
    field("district", "Centro");
    field("number", "150");
    field("instagramUsername", "@marina.exemplo");
    expect((document.getElementById("wizard-cpf") as HTMLInputElement).value).toBe(
      "529.982.247-25",
    );
    next();
    expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
    field("niche", "Outro");
    next();
    expect(screen.getByText(/Informe qual é o outro nicho/)).toBeInTheDocument();
    field("otherNiche", "Livros");
    field("niche", "Lifestyle");
    field("niche", "Outro");
    expect((document.getElementById("wizard-otherNiche") as HTMLInputElement).value).toBe("");
    field("otherNiche", "Livros");
    field("tiktokFollowers", "Não utilizo TikTok");
    next();

    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
    field("municipalRegistration", "sim");
    next();
    expect(screen.getByText(/Informe o número da inscrição municipal/)).toBeInTheDocument();
    field("municipalNumber", "MUNICIPAL-TEST-12");
    field("municipalRegistration", "nao");
    field("municipalRegistration", "sim");
    expect((document.getElementById("wizard-municipalNumber") as HTMLInputElement).value).toBe("");
    field("municipalNumber", "MUNICIPAL-TEST-12");
    field("dependents", "Não tenho");
    next();

    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    field("preferredLine", "Botox Vonix");
    field("couponSuggestion", "MARINA10");
    next();
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    const privacy = screen.getByRole("link", {
      name: "Política de Privacidade (abre em nova aba)",
    });
    expect(privacy).toHaveAttribute("target", "_blank");
    expect(privacy).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/abre em nova aba, sem perder o formulário/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revise sua candidatura" })).toBeInTheDocument();
    expect(screen.getByText("marina@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sugestão de cupom: MARINA10")).toBeInTheDocument();
    expect(screen.queryByText("529.982.247-25")).not.toBeInTheDocument();
    field("hairType", "Cacheado");
    fireEvent.click(screen.getByRole("button", { name: /Simular finalização/i }));
    const terms = document.getElementById("wizard-termsAccepted") as HTMLInputElement;
    expect(terms).toHaveAttribute("aria-invalid", "true");
    expect(terms).toHaveAttribute("aria-describedby", "wizard-error-termsAccepted");
    expect(screen.getByText(/É necessário aceitar os termos/)).toHaveAttribute(
      "id",
      "wizard-error-termsAccepted",
    );
    fireEvent.click(terms);
    expect(terms).not.toHaveAttribute("aria-describedby");
    fireEvent.click(screen.getByRole("button", { name: /Simular finalização/i }));
    expect(screen.getByText(/prévia interativa/i)).toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    expect((document.getElementById("wizard-couponSuggestion") as HTMLInputElement).value).toBe(
      "MARINA10",
    );
    next();
    fireEvent.click(screen.getByRole("button", { name: "Editar dados pessoais e contato" }));
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    expect((document.getElementById("wizard-firstName") as HTMLInputElement).value).toBe("Marina");
    expect(api.submit).not.toHaveBeenCalled();
  });

  it("focuses the newly rendered stage heading on navigation", async () => {
    render(<AffiliateWizard preview />);
    field("firstName", "Marina");
    field("lastName", "Exemplo");
    field("phone", "31999999999");
    field("email", "marina@example.com");
    field("emailConfirmation", "marina@example.com");
    field("cpf", "52998224725");
    field("birthDate", "1998-09-14");
    field("birthCity", "Belo Horizonte");
    field("postalCode", "30110012");
    field("city", "Belo Horizonte");
    field("state", "MG");
    field("street", "Rua da Bahia");
    field("district", "Centro");
    field("number", "150");
    field("instagramUsername", "marina.exemplo");
    next();
    expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Seu conteúdo" })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Dados pessoais" })).toHaveFocus(),
    );
  });

  it("discards a postal-code lookup response after the user changes the CEP", async () => {
    let answer: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AffiliateWizard />);
    field("postalCode", "30110012");
    fireEvent.blur(document.getElementById("wizard-postalCode")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("30110012"),
      expect.objectContaining({ signal: expect.anything() }),
    );
    field("postalCode", "31200000");
    await act(async () => {
      answer?.(
        Response.json({
          localidade: "Cidade Antiga",
          uf: "MG",
          logradouro: "Rua Antiga",
          bairro: "Bairro Antigo",
        }),
      );
    });
    expect((document.getElementById("wizard-city") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("wizard-street") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("wizard-postalCode") as HTMLInputElement).value).toBe(
      "31200-000",
    );
  });

  it("enviará somente uma candidatura validada quando o cadastro for autorizado", async () => {
    let complete: ((value: { ok: true }) => void) | undefined;
    api.submit.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<AffiliateWizard />);

    field("firstName", "Marina");
    field("lastName", "Exemplo");
    field("phone", "31999999999");
    field("email", "marina@example.com");
    field("emailConfirmation", "marina@example.com");
    field("cpf", "52998224725");
    field("birthDate", "1998-09-14");
    field("birthCity", "Belo Horizonte");
    field("postalCode", "30110012");
    field("city", "Belo Horizonte");
    field("state", "MG");
    field("street", "Rua da Bahia");
    field("district", "Centro");
    field("number", "150");
    field("instagramUsername", "marina.exemplo");
    next();

    field("niche", "Lifestyle");
    field("tiktokFollowers", "Não utilizo TikTok");
    next();
    field("municipalRegistration", "nao");
    field("dependents", "Não tenho");
    next();
    field("preferredLine", "Botox Vonix");
    field("couponSuggestion", "MARINA10");
    next();
    field("hairType", "Cacheado");
    fireEvent.click(document.getElementById("wizard-termsAccepted")!);
    const send = screen.getByRole("button", { name: /Enviar candidatura/i });
    // Submit twice inside a single React batch before disabled state is rendered.
    act(() => {
      fireEvent.submit(send.closest("form")!);
      fireEvent.submit(send.closest("form")!);
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: "Marina Exemplo",
        email: "marina@example.com",
        privacyAccepted: true,
        wizard: expect.objectContaining({
          couponSuggestion: "MARINA10",
          preferredLine: "Botox Vonix",
        }),
      }),
    });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(api.submit).toHaveBeenCalledTimes(1);
    await act(async () => {
      complete?.({ ok: true });
    });
    expect(screen.getByText("Candidatura recebida!")).toBeInTheDocument();
    expect(screen.queryByText("Passo 5 de 5")).not.toBeInTheDocument();
  });
});
