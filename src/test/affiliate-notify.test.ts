import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyAffiliateSale } from "@/lib/affiliate-notify.server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("aviso da venda da afiliada", () => {
  it("sem configuração não chama ninguém", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect(await notifyAffiliateSale({ orderId: 1, status: "pago" })).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("envia o pedido com a chave secreta", async () => {
    vi.stubEnv("AFFILIATE_APP_URL", "https://app.exemplo.com/");
    vi.stubEnv("AFFILIATE_SITE_SECRET", "segredo-de-teste");
    const f = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", f);
    expect(await notifyAffiliateSale({ orderId: 55, status: "pendente", ref: "isabela", totalCents: 17490 })).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://app.exemplo.com/api/public/afiliadas/venda");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer segredo-de-teste");
    expect(JSON.parse(String(init.body))).toEqual({ order_id: "55", status: "pendente", ref: "isabela", total_cents: 17490 });
  });

  it("falha de rede não quebra o checkout", async () => {
    vi.stubEnv("AFFILIATE_APP_URL", "https://app.exemplo.com");
    vi.stubEnv("AFFILIATE_SITE_SECRET", "x");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect(await notifyAffiliateSale({ orderId: 1, status: "pago" })).toBe(false);
  });
});
