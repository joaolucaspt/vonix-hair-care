import { describe, expect, it } from "vitest";
import { isValidCpf } from "@/lib/cpf";

describe("isValidCpf", () => {
  it("accepts a CPF with correct check digits, with or without mask", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejects wrong digits, repeated digits and wrong length", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});
