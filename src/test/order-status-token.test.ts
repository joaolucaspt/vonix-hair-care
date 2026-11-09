import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env.server", () => ({
  requireEnv: (key: string) => (key === "APPMAX_CLIENT_SECRET" ? "secret-of-test-only" : ""),
}));
import { orderStatusToken, validOrderStatusToken } from "@/lib/order-status-token.server";

describe("capability for polling an Appmax order", () => {
  it("accepts only the capability issued for the same order", () => {
    const token = orderStatusToken(111);
    expect(token).not.toContain("secret");
    expect(validOrderStatusToken(111, token)).toBe(true);
    expect(validOrderStatusToken(112, token)).toBe(false);
    expect(validOrderStatusToken(111, "111")).toBe(false);
  });
  it("rejects invalid order ids, token tampering and malformed token", () => {
    expect(() => orderStatusToken(-1)).toThrow();
    expect(validOrderStatusToken(1, "z".repeat(500))).toBe(false);
    expect(validOrderStatusToken(1, orderStatusToken(1).slice(1))).toBe(false);
  });
});
