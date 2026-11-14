import { describe, expect, it } from "vitest";
import { shippingText } from "@/lib/store";

describe("shippingText", () => {
  it("frete grátis: sem transportadora e com prazo em faixa de 2 a 3 dias úteis", () => {
    const t = shippingText({ company: "Correios", name: "PAC", days: 3, free: true });
    expect(t.title).toBe("Frete grátis");
    expect(t.eta).toBe("2 a 3 dias úteis");
    expect(`${t.title} ${t.eta}`).not.toMatch(/Correios|PAC|JeT|Jadlog/);
  });
  it("frete grátis com prazo curto também mostra 2 a 3 dias úteis", () => {
    expect(shippingText({ company: "JeT", name: "Standard", days: 1, free: true }).eta).toBe("2 a 3 dias úteis");
  });
  it("frete grátis com prazo longo não promete menos do que a cotação", () => {
    expect(shippingText({ company: "Correios", name: "PAC", days: 9, free: true }).eta).toBe("8 a 9 dias úteis");
  });
  it("frete pago continua com transportadora e prazo real", () => {
    const t = shippingText({ company: "Correios", name: "SEDEX", days: 2, free: false });
    expect(t.title).toBe("Correios SEDEX");
    expect(t.eta).toBe("até 2 dias úteis");
  });
});
