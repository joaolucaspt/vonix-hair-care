import { beforeEach, describe, expect, it } from "vitest";
import { captureRef, getRef, normalizeRef, refCampaign } from "@/lib/affiliate-ref";

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

  it("marca do pedido", () => expect(refCampaign("isabela")).toBe("afiliada-isabela"));
});
