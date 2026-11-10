import { describe, expect, it } from "vitest";
import pages from "@/data/pages.json";
import { SITE_URL } from "@/lib/store";

describe("consistência pública de domínio e políticas", () => {
  it("mantém o site canônico nas políticas de privacidade e termos", () => {
    const domain = new URL(SITE_URL).hostname;
    expect(domain).toBe("vonixhair.com");
    expect(pages["termos-de-uso"]).toContain(`Site: ${domain}`);
    // The canonical storefront and legacy brand domain are both documented;
    // do not remove the separate affiliate-data policy during branch sync.
    const privacy = pages["politica-de-privacidade"];
    expect(privacy).toContain(`vonixhaircosmeticos.com.br e ${domain}`);
    expect(privacy).toContain("## 2A. INSCRIÇÕES PARA O PROGRAMA DE AFILIADAS");
    expect(privacy).toContain("As ferramentas opcionais Google Analytics");
  });

  it("preserva os contatos de atendimento ao corrigir o domínio comercial", () => {
    for (const page of ["termos-de-uso", "politica-de-privacidade"] as const) {
      expect(pages[page]).toContain("contato@vonixhaircosmeticos.com.br");
      expect(pages[page]).toContain("68.272.005/0001-07");
    }
  });
});
