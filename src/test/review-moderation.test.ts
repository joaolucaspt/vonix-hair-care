import { describe, expect, it } from "vitest";
import { moderate } from "@/lib/review-moderation";

describe("conferência automática das avaliações", () => {
  it("avaliação normal aparece na hora", () => {
    expect(moderate("Maria", "Adorei o resultado, cabelo macio e brilhante. Já comprei de novo!").status).toBe("aprovada");
    expect(moderate("João da Silva", "Muito bom, chegou rápido e o cheiro é ótimo.").status).toBe("aprovada");
    expect(moderate("Ana", "Usei 2 vezes por semana durante 3 meses e gostei.").status).toBe("aprovada");
  });
  it("link, contato e telefone ficam pendentes (spam)", () => {
    for (const t of ["compre em www.loja.com barato", "chama no zap 11 98888-7777 que eu vendo", "me siga @lojafake_oficial", "veja https://golpe.com", "acesse bit.ly/xyz"]) {
      expect(moderate("Fulana", t).status).toBe("pendente");
    }
  });
  it("palavrão, ofensa e propaganda ficam pendentes", () => {
    expect(moderate("Fulano", "isso é uma merda, não funciona").status).toBe("pendente");
    expect(moderate("Fulano", "Produto lixo e golpe, não comprem").status).toBe("pendente");
    expect(moderate("Fulano", "ganhe dinheiro em casa agora mesmo").status).toBe("pendente");
    expect(moderate("Fulano", "aaaaaaaaaaaaaaaa muito bommmmmmmmmm").status).toBe("pendente");
  });
  it("palavra parecida com ofensa dentro de outra palavra não é bloqueada", () => {
    expect(moderate("Cuca", "Gostei muito, cultura de cuidado com os fios. Computador não ajuda, mas o produto sim.").status).toBe("aprovada");
  });
});
