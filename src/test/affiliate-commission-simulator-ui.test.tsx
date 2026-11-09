import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AffiliateCommissionSimulator } from "@/components/affiliate-commission-simulator";

afterEach(() => cleanup());

describe("Laboratório de comissões (isolado)", () => {
  it("é uma prévia inativa até que o gestor abra a ferramenta", () => {
    render(<AffiliateCommissionSimulator />);
    expect(screen.getByText("Laboratório de comissões")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir laboratório" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/Sem conexão com a Appmax/)).not.toBeInTheDocument();
  });

  it("exibe indicadores realistas somente da simulação, com estornos", () => {
    render(<AffiliateCommissionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir laboratório" }));
    expect(screen.getByText(/Ambiente 100% simulado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Carregar cenário fictício" }));
    expect(screen.getByText("R$ 19,99")).toBeInTheDocument();
    expect(screen.getByText("R$ 29,90")).toBeInTheDocument();
    expect(screen.getByText("EX001")).toBeInTheDocument();
    expect(screen.getByText("EX003")).toBeInTheDocument();
  });

  it("simula o ciclo pendente, pago e estornado de uma indicação", () => {
    render(<AffiliateCommissionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir laboratório" }));
    fireEvent.change(screen.getByLabelText("Código de indicação fictício"), {
      target: { value: "joana" },
    });
    fireEvent.change(screen.getByLabelText("Valor do pedido hipotético (R$)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar pedido" }));
    expect(screen.getByText("SIM0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simular pago" }));
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simular estorno" }));
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("Estornado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.queryByText("SIM0001")).not.toBeInTheDocument();
  });

  it("recusa entradas suspeitas e não as adiciona à tabela", () => {
    render(<AffiliateCommissionSimulator />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir laboratório" }));
    fireEvent.change(screen.getByLabelText("Código de indicação fictício"), {
      target: { value: "<script>" },
    });
    // Native HTML pattern prevents the click in a browser. Direct submission
    // additionally verifies the server-independent validation guard.
    const form = screen.getByLabelText("Código de indicação fictício").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(screen.getByRole("alert")).toHaveTextContent(/código simples/);
    expect(screen.queryByText("SIM0001")).not.toBeInTheDocument();
  });
});
