import { describe, expect, it } from "vitest";
import { brl } from "@/lib/store";

describe("formato dos valores em reais", () => {
  it("sempre R$ + espaço sem quebra + milhar com ponto + 2 casas decimais", () => {
    expect(brl(164.9)).toBe("R$\u00a0164,90");
    expect(brl(1234.5)).toBe("R$\u00a01.234,50");
    expect(brl(0)).toBe("R$\u00a00,00");
    expect(brl(420.5)).toBe("R$\u00a0420,50");
  });
  it("o espaço entre R$ e o número não deixa o valor quebrar em duas linhas", () => {
    expect(brl(99.9)).not.toMatch(/R\$ /);
    expect(brl(99.9)).toMatch(/^R\$\u00a0\d/);
  });
});
