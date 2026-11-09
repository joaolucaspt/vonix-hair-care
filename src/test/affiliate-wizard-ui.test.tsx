import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("@/lib/affiliate-functions", () => ({
  submitAffiliateApplication: api.submit,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
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
afterEach(() => cleanup());

describe("Vonix five-stage browser wizard", () => {
  it("requires step one personal data and validates identity before advancing", () => {
    render(<AffiliateWizard preview />);
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    next();
    expect(screen.getByText(/Informe seu primeiro nome/)).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
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
    next();

    expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
    field("niche", "Outro");
    next();
    expect(screen.getByText(/Informe qual é o outro nicho/)).toBeInTheDocument();
    field("otherNiche", "Livros");
    field("tiktokFollowers", "Não utilizo TikTok");
    next();

    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
    field("municipalRegistration", "sim");
    next();
    expect(screen.getByText(/Informe o número da inscrição municipal/)).toBeInTheDocument();
    field("municipalNumber", "MUNICIPAL-TEST-12");
    field("dependents", "Não tenho");
    next();

    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    field("preferredLine", "Botox Vonix");
    field("couponSuggestion", "MARINA10");
    next();
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    field("hairType", "Cacheado");
    fireEvent.click(document.getElementById("wizard-termsAccepted")!);
    fireEvent.click(screen.getByRole("button", { name: /Simular finalização/i }));
    expect(screen.getByText(/prévia interativa/i)).toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    expect((document.getElementById("wizard-couponSuggestion") as HTMLInputElement).value).toBe(
      "MARINA10",
    );
  });
});
