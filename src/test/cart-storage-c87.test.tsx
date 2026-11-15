import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCart } from "@/lib/store";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("C87 — carrinho resiliente quando armazenamento local falha", () => {
  it("mantém a compra em memória, notifica a interface e não quebra quando localStorage.setItem lança", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.clear());
    const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage quota reached", "QuotaExceededError");
    });
    expect(() =>
      act(() => result.current.add("kit-banana-e-mel", "Kit", 1)),
    ).not.toThrow();
    expect(fail).toHaveBeenCalled();
    expect(result.current.count).toBe(1);
    expect(result.current.lines[0]?.slug).toBe("kit-banana-e-mel");
    fail.mockRestore();
    act(() => result.current.clear());
  });
});
