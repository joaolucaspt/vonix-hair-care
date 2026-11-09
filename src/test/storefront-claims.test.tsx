import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Benefits } from "@/components/site";
import { getProduct, products } from "@/lib/store";
import pages from "@/data/pages.json";

describe("promessas comerciais coerentes com o checkout", () => {
  it("não anuncia frete grátis nem desconto Pix incondicionais no bloco de vantagens", () => {
    render(<Benefits />);
    expect(screen.getByText("Frete por CEP")).toBeInTheDocument();
    expect(screen.getByText(/grátis acima de R\$ 150, conforme cotação/i)).toBeInTheDocument();
    expect(screen.getByText("Até 5% no Pix")).toBeInTheDocument();
    expect(screen.getByText("somente itens sem outra oferta")).toBeInTheDocument();
    expect(screen.queryByText("5% OFF no Pix")).not.toBeInTheDocument();
  });

  it("a política informa cobertura por CEP antes de prometer frete gratuito", () => {
    expect(pages["politica-de-frete"]).toContain("depende de uma cotação válida de transportadora");
    expect(pages["politica-de-frete"]).toContain("não será possível concluir o pedido para esse endereço");
  });

  it("mantém os 42 produtos ativos e exclui Plex Vonix sem estoque da vitrine", () => {
    expect(products.length).toBe(42);
    expect(getProduct("plex-vonix")).toBeUndefined();
    expect(getProduct("kit-banana-e-mel")?.variants[0]?.price).toBe(169.9);
  });
});
