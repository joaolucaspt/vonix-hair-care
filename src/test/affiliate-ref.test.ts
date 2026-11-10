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

  it("entrou pelo link e comprou vários produtos na mesma visita: conta para ela", () => {
    captureRef("?ref=isabela&utm_source=ig");
    expect(getRef()).toBe("isabela"); // página de produto
    expect(getRef()).toBe("isabela"); // carrinho
    expect(getRef()).toBe("isabela"); // checkout
  });

  it("ignora código inválido e não apaga o que já estava salvo na visita", () => {
    captureRef("?ref=isabela");
    captureRef("?ref=<b>");
    captureRef("");
    expect(getRef()).toBe("isabela");
  });

  it("voltar depois, sem o link (aba nova), não conta mais para ela", () => {
    captureRef("?ref=isabela");
    sessionStorage.clear(); // aba fechada e site aberto de novo
    captureRef("");
    expect(getRef()).toBeNull();
  });

  it("a visita expira: aba esquecida aberta não conta no dia seguinte", () => {
    captureRef("?ref=isabela", 1_000);
    expect(getRef(1_000 + 2 * 3_600_000)).toBe("isabela");
    expect(getRef(1_000 + 4 * 3_600_000)).toBeNull();
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
