import { beforeEach, describe, expect, it, vi } from "vitest";
const settings = vi.hoisted(() => ({
  secret: "unit-test-only-idempotency-secret-with-48-characters",
}));
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    (
      ({
        CHECKOUT_IDEMPOTENCY_SECRET: settings.secret,
        SUPABASE_URL: "https://isolated-database.example",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-mock-for-tests",
      }) as Record<string, string>
    )[name] ?? "",
}));
import {
  checkoutFingerprint,
  claimCheckoutIntent,
  advanceCheckoutIntent,
  finalizeCheckoutIntent,
} from "@/lib/checkout-idempotency.server";

const input = {
  document: "529.982.247-25",
  address: {
    postcode: "30140-010",
    street: " Rua Teste ",
    number: "20",
    city: "Belo Horizonte",
    state: "mg",
  },
  items: [
    { sku: "itemB:Grande", quantity: 1 },
    { sku: "itemA:Pequeno", quantity: 2 },
  ],
};

const token = "11111111-1111-4111-8111-111111111111";
const mockFetch = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  settings.secret = "unit-test-only-idempotency-secret-with-48-characters";
  vi.stubGlobal("fetch", mockFetch);
});

describe("HMAC checkout fingerprint", () => {
  it("normalizes CPF, address and cart order, without disclosing customer data", () => {
    const a = checkoutFingerprint(input);
    const b = checkoutFingerprint({
      ...input,
      document: "52998224725",
      items: [...input.items].reverse(),
      address: {
        ...input.address,
        postcode: "30140010",
        street: "rua teste",
        state: "MG",
      },
    });
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toContain("52998224725");
  });
  it("merges split cart lines for the same physical SKU and quantity", () => {
    const a = checkoutFingerprint(input);
    const b = checkoutFingerprint({
      ...input,
      items: [
        { sku: "itemB:Grande", quantity: 1 },
        { sku: "itemA:Pequeno", quantity: 1 },
        { sku: "itemA:Pequeno", quantity: 1 },
      ],
    });
    expect(a).toBe(b);
  });
  it("distinguishes genuinely different delivery destinations and physical goods", () => {
    const id = checkoutFingerprint(input);
    expect(checkoutFingerprint({ ...input, address: { ...input.address, number: "21" } })).not.toBe(
      id,
    );
    expect(
      checkoutFingerprint({ ...input, items: [{ sku: "itemA:Pequeno", quantity: 2 }] }),
    ).not.toBe(id);
    expect(
      checkoutFingerprint({ ...input, items: [{ sku: "itemB:Diferente", quantity: 1 }] }),
    ).not.toBe(id);
  });
  it("rejects empty or invalid item quantities instead of creating fingerprint collisions", () => {
    expect(() => checkoutFingerprint({ ...input, items: [] })).toThrow("Carrinho vazio");
    expect(() => checkoutFingerprint({ ...input, items: [{ sku: "A", quantity: -1 }] })).toThrow(
      "Itens de compra inválidos",
    );
  });
  it("fails closed without a strong server-only HMAC secret", () => {
    settings.secret = "short";
    expect(() => checkoutFingerprint(input)).toThrow(
      "Proteção contra pagamentos duplicados indisponível",
    );
  });
});

describe("durable intent storage contract", () => {
  it("claims an attempt and never exposes the claim token on duplicates", async () => {
    mockFetch
      .mockResolvedValueOnce(
        Response.json({
          claimed: true,
          phase: "reserved",
          orderId: null,
          claimToken: token,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          claimed: false,
          phase: "charging",
          orderId: 1510,
          claimToken: null,
        }),
      );
    const fp = checkoutFingerprint(input);
    expect(await claimCheckoutIntent(fp)).toMatchObject({ claimed: true, claimToken: token });
    expect(await claimCheckoutIntent(fp)).toEqual({
      claimed: false,
      phase: "charging",
      orderId: 1510,
      claimToken: null,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of mockFetch.mock.calls) {
      expect(String(url)).toContain("/rpc/vonix_checkout_claim");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ p_fingerprint: fp });
      expect(init.body).not.toContain(input.document);
      expect(init.body).not.toContain("Teste@Example.com");
    }
  });
  it("rejects invalid claims and storage errors before any gateway call", async () => {
    mockFetch.mockResolvedValueOnce(
      Response.json({ claimed: true, phase: "reserved", orderId: null, claimToken: null }),
    );
    await expect(claimCheckoutIntent(checkoutFingerprint(input))).rejects.toThrow(
      "Reserva de pagamento inválida",
    );
    mockFetch.mockResolvedValueOnce(new Response("storage unavailable", { status: 503 }));
    await expect(claimCheckoutIntent(checkoutFingerprint(input))).rejects.toThrow(
      "Intent storage HTTP 503",
    );
  });
  it("advances only exact fenced transitions and rejects stale claims", async () => {
    const fp = checkoutFingerprint(input);
    mockFetch
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json(false));
    await advanceCheckoutIntent(fp, token, "reserved");
    await advanceCheckoutIntent(fp, token, "creating_order", 1510);
    await advanceCheckoutIntent(fp, token, "order_created");
    await expect(advanceCheckoutIntent(fp, token, "charging")).rejects.toThrow(
      "Reserva de pedido perdida",
    );
    const args = mockFetch.mock.calls.map(([, config]) => JSON.parse(config.body));
    expect(args.map((x) => [x.p_expected, x.p_next, x.p_order_id])).toEqual([
      ["reserved", "creating_order", null],
      ["creating_order", "order_created", 1510],
      ["order_created", "charging", null],
      ["charging", "submitted", null],
    ]);
  });
  it("finalizes only validated order IDs and authorized outcomes", async () => {
    mockFetch.mockResolvedValue(Response.json(true));
    await finalizeCheckoutIntent(1510, "completed");
    expect(JSON.parse(mockFetch.mock.calls[0]![1].body)).toEqual({
      p_order_id: 1510,
      p_outcome: "completed",
    });
    await expect(finalizeCheckoutIntent(0, "cancelled")).rejects.toThrow("Pedido inválido");
  });
});
