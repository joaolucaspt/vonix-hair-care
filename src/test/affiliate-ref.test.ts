import { beforeEach, describe, expect, it } from "vitest";
import { captureRef, clearRef, getRef, normalizeRef, refCampaign } from "@/lib/affiliate-ref";

describe("código da afiliada no site", () => {
  beforeEach(() => localStorage.clear());

  it("só aceita letras, números e hífen", () => {
    expect(normalizeRef("Isabela")).toBe("isabela");
    expect(normalizeRef("ana-paula2")).toBe("ana-paula2");
    for (const bad of ["", "a b", "<script>", "isabela;drop", "x".repeat(31), null, 5]) expect(normalizeRef(bad)).toBeNull();
  });

  it("guarda o código do link e devolve em outra página", () => {
    captureRef("?ref=isabela&utm_source=ig");
    expect(getRef()).toBe("isabela");
  });

  it("ignora código inválido e não apaga o que já estava salvo", () => {
    captureRef("?ref=isabela");
    captureRef("?ref=<b>");
    captureRef("");
    expect(getRef()).toBe("isabela");
  });

  it("expira depois de 30 dias", () => {
    captureRef("?ref=isabela", 1_000);
    expect(getRef(1_000 + 29 * 86_400_000)).toBe("isabela");
    expect(getRef(1_000 + 31 * 86_400_000)).toBeNull();
  });

  it("vale mesmo que a pessoa demore quase um mês para comprar", () => {
    captureRef("?ref=isabela", 1_000);
    expect(getRef(1_000 + 29 * 86_400_000)).toBe("isabela");
  });

  it("vale para uma compra só: depois de paga, o código é apagado", () => {
    captureRef("?ref=isabela");
    expect(getRef()).toBe("isabela");
    clearRef(); // compra paga
    expect(getRef()).toBeNull();
  });

  it("depois da primeira compra, entrar de novo sem o link não conta para ela", () => {
    captureRef("?ref=isabela");
    clearRef();
    captureRef("");
    expect(getRef()).toBeNull();
  });

  it("um link novo depois da compra volta a valer, para uma nova compra", () => {
    captureRef("?ref=isabela");
    clearRef();
    captureRef("?ref=isabela");
    expect(getRef()).toBe("isabela");
  });

  it("marca do pedido", () => expect(refCampaign("isabela")).toBe("afiliada-isabela"));
});
