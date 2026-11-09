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
  it("expires after 24 hours and rejects future-issued tokens", () => {
    const epoch = 1_800_000_000_000;
    const token = orderStatusToken(111, epoch);
    expect(validOrderStatusToken(111, token, epoch)).toBe(true);
    expect(validOrderStatusToken(111, token, epoch + 23 * 60 * 60 * 1000)).toBe(true);
    expect(validOrderStatusToken(111, token, epoch + 24 * 60 * 60 * 1000 + 1000)).toBe(false);
    expect(validOrderStatusToken(111, token, epoch - 2 * 60 * 1000)).toBe(false);
  });
  it("rejects legacy token, malformed timestamp and modified signature", () => {
    const epoch = 1_800_000_000_000;
    const token = orderStatusToken(111, epoch);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(validOrderStatusToken(111, parts[2]!, epoch)).toBe(false);
    expect(validOrderStatusToken(111, `v2.fake.${parts[2]}`, epoch)).toBe(false);
    expect(validOrderStatusToken(111, `v2.${parts[1]}.${"a".repeat(43)}`, epoch)).toBe(false);
  });
  it("rejects invalid order ids, token tampering and malformed token", () => {
    expect(() => orderStatusToken(-1)).toThrow();
    expect(validOrderStatusToken(1, "z".repeat(500))).toBe(false);
    expect(validOrderStatusToken(1, orderStatusToken(1).slice(1))).toBe(false);
  });
});
