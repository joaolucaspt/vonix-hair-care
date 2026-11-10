import { beforeEach, describe, expect, it } from "vitest";
import { captureRef, getRef, normalizeRef, refCampaign } from "@/lib/affiliate-ref";

describe("código da afiliada no site", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("só aceita letras, números e hífen", () => {
    expect(normalizeRef("Isabela")).toBe("isabela");
    expect(normalizeRef("ana-paula2")).toBe("ana-paula2");
    for (const bad of ["", "a b", "<script>", "isabela;drop", "x".repeat(31), null, 5]) expect(normalizeRef(bad)).toBeNull();
  });

  it("guarda o código do link e devolve em outra página da mesma visita", () => {
    captureRef("?ref=isabela&utm_source=ig");
    expect(getRef()).toBe("isabela");
  });

  it("ignora código inválido e não apaga o que já estava salvo na visita", () => {
    captureRef("?ref=isabela");
    captureRef("?ref=<b>");
    captureRef("");
    expect(getRef()).toBe("isabela");
  });

  it("vale só na visita: depois de fechar a aba (sessão nova) não conta mais", () => {
    captureRef("?ref=isabela");
    sessionStorage.clear(); // aba fechada e site aberto de novo, sem o link
    captureRef("");
    expect(getRef()).toBeNull();
  });

  it("nunca guarda o código no navegador de forma duradoura", () => {
    captureRef("?ref=isabela");
    expect(localStorage.getItem("vonix-ref")).toBeNull();
  });

  it("apaga o código de 30 dias que versões antigas do site deixaram guardado", () => {
    localStorage.setItem("vonix-ref", JSON.stringify({ ref: "isabela", until: Date.now() + 29 * 86_400_000 }));
    expect(getRef()).toBeNull();
    expect(localStorage.getItem("vonix-ref")).toBeNull();
  });

  it("o link de outra afiliada na mesma visita passa a valer para ela", () => {
    captureRef("?ref=isabela");
    captureRef("?ref=ana-paula");
    expect(getRef()).toBe("ana-paula");
  });

  it("marca do pedido", () => expect(refCampaign("isabela")).toBe("afiliada-isabela"));
});
