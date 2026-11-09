import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProduct, getSavedCep, saveCep, useAudience, useCart } from "@/lib/store";

afterEach(() => vi.restoreAllMocks());

describe("carrinho e checkout quando o navegador bloqueia armazenamento", () => {
  it("permite iniciar checkout sem leitura ou gravação de CEP no localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    expect(getSavedCep()).toBe("");
    expect(() => saveCep("30140010")).not.toThrow();
  });

  it("continua mostrando o produto adicionado ao carrinho quando setItem falha", () => {
    const p = getProduct("kit-banana-e-mel")!;
    const { result, unmount } = renderHook(() => useCart());
    act(() => result.current.clear());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(() =>
      act(() => result.current.add(p.slug, p.variants[0].label, 1)),
    ).not.toThrow();
    expect(result.current.count).toBe(1);
    expect(result.current.lines[0]?.product.slug).toBe(p.slug);
    expect(() => act(() => result.current.clear())).not.toThrow();
    unmount();
  });

  it("permite trocar o ambiente comercial quando sessionStorage falha", () => {
    const { result, unmount } = renderHook(() => useAudience());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    expect(() => act(() => result.current.set("casa"))).not.toThrow();
    expect(result.current.audience).toBe("casa");
    unmount();
  });
});
