import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  env: (key: string) =>
    key === "APPMAX_ENV"
      ? "sandbox"
      : key === "BLING_CLIENT_ID"
        ? "client-test"
        : key === "BLING_CLIENT_SECRET"
          ? "secret-test"
          : key === "SUPABASE_URL"
            ? "https://isolated.example"
            : key === "SUPABASE_SERVICE_ROLE_KEY"
              ? "role-test"
              : "",
  requireEnv: (key: string) =>
    key === "APPMAX_CLIENT_ID" ? "merchant-client-test" : "merchant-secret-test",
}));
vi.mock("@/lib/bling-refresh.server", () => ({
  readBlingRefreshToken: vi.fn().mockResolvedValue("long-refresh-token-test"),
  rotateBlingRefreshToken: vi.fn().mockResolvedValue(undefined),
}));

import { getOrder } from "@/lib/appmax.server";
import { sendPaidOrder } from "@/lib/bling.server";
import type { OrderSnapshot } from "@/lib/order-snapshot.server";

const sample: OrderSnapshot = {
  orderId: 15001,
  customer: {
    name: "Comprador Teste",
    email: "test@example.com",
    phone: "31999999999",
    documentNumber: "52998224725",
  },
  address: {
    street: "Rua Teste",
    number: "10",
    complement: "",
    district: "Centro",
    city: "Belo Horizonte",
    state: "MG",
    postcode: "30140010",
  },
  products: [{ sku: "kit-banana-e-mel", name: "Combo", quantity: 1, unitValueCents: 15490 }],
  shippingValueCents: 0,
  discountValueCents: 0,
};

describe("external gateways must not hang an outbox lease indefinitely", () => {
  it("sends a finite AbortSignal to Appmax auth and order status requests", async () => {
    const calls: { url: string; signal: unknown }[] = [];
    const network = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      calls.push({ url, signal: init.signal });
      if (url.endsWith("/oauth2/token"))
        return Response.json({ access_token: "test-token", expires_in: 3600 });
      return Response.json({ data: { order: { id: 15001, status: "integrado" } } });
    });
    vi.stubGlobal("fetch", network);
    expect((await getOrder(15001)).data.order.status).toBe("integrado");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const call of calls) expect(call.signal).toBeInstanceOf(AbortSignal);
  });
  it("times out Bling token generation, order lookup and export calls", async () => {
    const calls: { url: string; signal: unknown }[] = [];
    const network = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      calls.push({ url, signal: init.signal });
      if (url.includes("/oauth/token"))
        return Response.json({
          access_token: "fake-access",
          refresh_token: "fake-refresh-token-long-enough",
          expires_in: 3600,
        });
      if (init.method === "GET") return Response.json({ data: [] });
      return Response.json({ data: { id: 99 } });
    });
    vi.stubGlobal("fetch", network);
    expect(await sendPaidOrder(sample)).toBe("enviado");
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) expect(call.signal).toBeInstanceOf(AbortSignal);
  });
});
