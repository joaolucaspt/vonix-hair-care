import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env.server", () => ({
  env: (key: string) =>
    (
      ({
        BLING_CLIENT_ID: "client-id-test",
        BLING_CLIENT_SECRET: "client-secret-test",
        SUPABASE_URL: "https://fake-db.example",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-fake",
        BLING_LOJA_ID: "99",
      }) as Record<string, string>
    )[key] ?? "",
  requireEnv: (key: string) =>
    key === "BLING_CLIENT_ID" ? "client-id-test" : "client-secret-test",
}));
vi.mock("@/lib/bling-refresh.server", () => ({
  readBlingRefreshToken: vi.fn().mockResolvedValue("fake-refresh-token-long-enough"),
  rotateBlingRefreshToken: vi.fn().mockResolvedValue(undefined),
}));
import { sendPaidOrder } from "@/lib/bling.server";
import type { OrderSnapshot } from "@/lib/order-snapshot.server";
const snapshot: OrderSnapshot = {
  orderId: 4513,
  customer: {
    name: "Pessoa Teste",
    email: "test@example.com",
    phone: "31999999999",
    documentNumber: "52998224725",
  },
  address: {
    street: "Rua das Flores",
    number: "12",
    complement: "",
    district: "Centro",
    city: "Belo Horizonte",
    state: "MG",
    postcode: "30140010",
  },
  products: [
    { sku: "kit-banana-e-mel", name: "Combo Banana e Mel", quantity: 1, unitValueCents: 15490 },
  ],
  shippingValueCents: 1705,
  discountValueCents: 775,
};
const network = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", network);
  network.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.includes("/oauth/token"))
      return Response.json({
        access_token: "fake-access-token",
        refresh_token: "fake-refresh",
        expires_in: 3600,
      });
    if (init.method === "GET" && url.includes("/pedidos/vendas?"))
      return Response.json({ data: [] });
    if (init.method === "POST" && url.endsWith("/pedidos/vendas"))
      return Response.json({ data: { id: 999 } });
    throw Error("Unexpected URL");
  });
});
describe("Bling ERP sales from checkout snapshots", () => {
  it("uses snapshot products, address and BRL decimals, not incomplete Appmax order payload", async () => {
    expect(await sendPaidOrder(snapshot)).toBe("enviado");
    const call = network.mock.calls.find(
      ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
    )!;
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      numeroLoja: "4513",
      contato: { nome: "Pessoa Teste", numeroDocumento: "52998224725" },
      itens: [{ codigo: "kit-banana-e-mel", quantidade: 1, valor: 154.9 }],
      desconto: { unidade: "REAL", valor: 7.75 },
      transporte: { frete: 17.05, etiqueta: { municipio: "Belo Horizonte", cep: "30140010" } },
    });
  });
  it("does not create a duplicate if Bling reports an existing store order", async () => {
    network.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "GET" && url.includes("/pedidos/vendas?"))
        return Response.json({ data: [{ numeroLoja: "4513" }] });
      if (url.includes("/oauth/token"))
        return Response.json({
          access_token: "fake-access-token",
          refresh_token: "fake-refresh",
          expires_in: 3600,
        });
      throw Error("A duplicate POST was attempted");
    });
    expect(await sendPaidOrder(snapshot)).toBe("ja enviado");
    expect(
      network.mock.calls.filter(
        ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
      ),
    ).toHaveLength(0);
  });
  it("refuses export when a filtered deduplication reply contains an unrelated store order", async () => {
    network.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "GET" && url.includes("/pedidos/vendas?"))
        return Response.json({ data: [{ numeroLoja: "other-store-778" }] });
      throw Error("Unexpected attempted order creation");
    });
    await expect(sendPaidOrder(snapshot)).rejects.toThrow("outra referência");
    expect(
      network.mock.calls.filter(
        ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
      ),
    ).toHaveLength(0);
  });

  it("does not treat a malformed HTTP 200 create reply as a confirmed ERP export", async () => {
    network.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "GET" && url.includes("/pedidos/vendas?"))
        return Response.json({ data: [] });
      if (init.method === "POST" && url.endsWith("/pedidos/vendas"))
        return Response.json({ data: {} });
      if (url.includes("/oauth/token"))
        return Response.json({
          access_token: "test",
          refresh_token: "refresh-test",
          expires_in: 300,
        });
      throw Error("Unexpected test call");
    });
    await expect(sendPaidOrder(snapshot)).rejects.toThrow("não confirmou o ID");
    expect(
      network.mock.calls.filter(
        ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("recovers a previous ambiguous POST using store-number lookup instead of posting again", async () => {
    let lookupCount = 0;
    network.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "GET" && url.includes("/pedidos/vendas?")) {
        lookupCount++;
        return Response.json({
          data: lookupCount === 1 ? [] : [{ numeroLoja: "4513" }],
        });
      }
      if (init.method === "POST" && url.endsWith("/pedidos/vendas"))
        return Response.json({ data: { id: null } });
      if (url.includes("/oauth/token"))
        return Response.json({
          access_token: "test",
          refresh_token: "refresh-test",
          expires_in: 300,
        });
      throw Error("Unexpected provider URL");
    });
    await expect(sendPaidOrder(snapshot)).rejects.toThrow("não confirmou o ID");
    expect(await sendPaidOrder(snapshot)).toBe("ja enviado");
    expect(
      network.mock.calls.filter(
        ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("fails closed if deduplication reply omits the store reference", async () => {
    network.mockImplementation(async (url: string, init: RequestInit) => {
      if (init.method === "GET" && url.includes("/pedidos/vendas?"))
        return Response.json({ data: [{ id: 10 }] });
      throw Error("A duplicate POST was attempted");
    });
    await expect(sendPaidOrder(snapshot)).rejects.toThrow("referência de loja");
    expect(
      network.mock.calls.filter(
        ([url, init]) => String(url).endsWith("/pedidos/vendas") && init.method === "POST",
      ),
    ).toHaveLength(0);
  });
});
