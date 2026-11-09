import { describe, expect, it } from "vitest";
import pages from "@/data/pages.json";
import { SITE_URL } from "@/lib/store";

describe("consistência pública de domínio e políticas", () => {
  it("mantém o site canônico nas políticas de privacidade e termos", () => {
    const domain = new URL(SITE_URL).hostname;
    expect(domain).toBe("vonixhair.com");
    expect(pages["termos-de-uso"]).toContain(`Site: ${domain}`);
    expect(pages["politica-de-privacidade"]).toContain(
      `utilização do site ${domain}`,
    );
  });

  it("preserva os contatos de atendimento ao corrigir o domínio comercial", () => {
    for (const page of ["termos-de-uso", "politica-de-privacidade"] as const) {
      expect(pages[page]).toContain("contato@vonixhaircosmeticos.com.br");
      expect(pages[page]).toContain("68.272.005/0001-07");
    }
  });
});
