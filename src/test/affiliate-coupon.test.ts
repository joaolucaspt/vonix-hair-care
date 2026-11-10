import { afterEach, describe, expect, it, vi } from "vitest";
import { isAffiliateCouponCode } from "@/lib/coupons";
import { resolveAffiliateCoupon } from "@/lib/affiliate-coupon.server";

describe("cupom de afiliada", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reconhece o formato NOME10", () => {
    expect(isAffiliateCouponCode("marissol10")).toBe(true);
    expect(isAffiliateCouponCode("ISABELA-C10")).toBe(true);
    expect(isAffiliateCouponCode("GIRA3")).toBe(false);
    expect(isAffiliateCouponCode("")).toBe(false);
  });

  it("vale 10% quando o app confirma, e não vale quando não confirma", async () => {
    const f = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("OKAFIL10") ? { ok: true, percent: 10, name: "Maria Silva" } : { ok: false })),
    );
    vi.stubGlobal("fetch", f);
    const ok = await resolveAffiliateCoupon("OKAFIL10");
    expect(ok?.percent).toBe(10);
    expect(ok?.label).toContain("Maria");
    expect(await resolveAffiliateCoupon("NAOEXISTE10")).toBeUndefined();
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/api/public/afiliadas/cupom?code=OKAFIL10");
  });

  it("falha de rede nunca dá desconto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("rede"); }));
    expect(await resolveAffiliateCoupon("REDEFALHA10")).toBeUndefined();
  });
});

describe("cupom de afiliada com código longo", () => {
  it("aceita o código de 30 caracteres mais o 10", () => {
    const ref = "ana-flavia-soares-dos-santos";
    expect(isAffiliateCouponCode(`${ref.toUpperCase()}10`)).toBe(true);
    expect(isAffiliateCouponCode(`${"A".repeat(30)}10`)).toBe(true);
    expect(isAffiliateCouponCode(`${"A".repeat(31)}10`)).toBe(false);
  });
});
