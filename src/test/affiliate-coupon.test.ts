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

  it("sem configuração do app de afiliadas, o cupom não vale", async () => {
    vi.stubEnv("AFFILIATE_APP_URL", "");
    vi.stubEnv("AFFILIATE_SITE_SECRET", "");
    expect(await resolveAffiliateCoupon("SEMCONFIG10")).toBeUndefined();
  });

  it("vale 10% quando o app confirma, e não vale quando não confirma", async () => {
    vi.stubEnv("AFFILIATE_APP_URL", "https://app.example");
    vi.stubEnv("AFFILIATE_SITE_SECRET", "segredo-de-teste");
    const f = vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("OKAFIL10") ? { ok: true, percent: 10, name: "Maria Silva" } : { ok: false })),
    );
    vi.stubGlobal("fetch", f);
    const ok = await resolveAffiliateCoupon("OKAFIL10");
    expect(ok?.percent).toBe(10);
    expect(ok?.label).toContain("Maria");
    expect(await resolveAffiliateCoupon("NAOEXISTE10")).toBeUndefined();
    expect((f.mock.calls[0] as unknown[])[1]).toMatchObject({ headers: { Authorization: "Bearer segredo-de-teste" } });
  });

  it("falha de rede nunca dá desconto", async () => {
    vi.stubEnv("AFFILIATE_APP_URL", "https://app.example");
    vi.stubEnv("AFFILIATE_SITE_SECRET", "segredo-de-teste");
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
