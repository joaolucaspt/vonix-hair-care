import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShippingBar, Summary } from "@/components/cart-summary";

describe("informação honesta de frete antes de informar o CEP", () => {
  it("não promete entrega gratuita sem cotação, mesmo após atingir o mínimo", () => {
    render(<ShippingBar subtotal={200} />);
    expect(screen.getByText(/atingiu o valor para frete grátis/i)).toBeInTheDocument();
    expect(screen.getByText(/confirmar disponibilidade/i).textContent).toBeDefined();
    expect(screen.queryByText(/o frete não será cobrado/i)).not.toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: /progresso para o frete grátis/i });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("indica o valor que falta e mantém a ressalva de cobertura", () => {
    render(<ShippingBar subtotal={89.9} />);
    expect(screen.getByText(/para alcançar o valor mínimo/i)).toBeInTheDocument();
    expect(screen.getByText(/sujeita à cotação de uma transportadora/i)).toBeInTheDocument();
  });

  it("não apresenta o subtotal como um total final de pagamento", () => {
    render(<Summary lines={[{ gross: 200, net: 200 }]} />);
    expect(screen.getByText(/elegível a grátis — confirmar CEP/i)).toBeInTheDocument();
    expect(screen.getByText(/produtos no pix \(sem frete/i)).toBeInTheDocument();
    expect(screen.getByText(/produtos no cartão \(sem frete\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/^total no pix/i)).not.toBeInTheDocument();
  });
});
