import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  values: {} as Record<string, string>,
  fetch: vi.fn(),
}));
vi.mock("@/lib/env.server", () => ({
  env: (key: string, fallback = "") => mocks.values[key] ?? fallback,
  requireEnv: (key: string) => {
    const v = mocks.values[key];
    if (!v) throw new Error(`Missing test config: ${key}`);
    return v;
  },
}));
import { calculateShipping, normalizeShippingQuotes } from "@/lib/melhorenvio.server";

const quote = (id: number, price: string | number, days: number) => ({
  id,
  name: "PAC",
  company: { name: "Correios" },
  price,
  delivery_time: days,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.values = {
    STORE_ORIGIN_CEP: "30140-010",
    MELHORENVIO_TOKEN: "test-only-carrier-token",
    MELHORENVIO_ENV: "sandbox",
  };
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(Response.json([quote(1, "25.90", 5)]));
});

describe("carrier price normalization fails closed on unusable quotes", () => {
  it("keeps valid allowed carriers and realistic days including same-day", () => {
    expect(
      normalizeShippingQuotes([
        quote(1, "25.90", 5),
        {
          id: 2,
          name: "Entrega",
          company: { name: "Jadlog" },
          custom_price: "0.00",
          delivery_time: 0,
        },
        { id: 3, name: "Rápida", company: { name: "JeT" }, price: 30.35, delivery_time: 2 },
      ]),
    ).toMatchObject([
      { id: 2, price: 0, days: 0 },
      { id: 1, price: 25.9, days: 5 },
      { id: 3, price: 30.35, days: 2 },
    ]);
  });

  it("rejects negative, nonnumeric, empty, infinite and missing prices", () => {
    const invalid = [-1, "-0.01", "nan", "Infinity", "", null, undefined, {}, "R$ 20"];
    expect(
      normalizeShippingQuotes(invalid.map((price, i) => ({ ...quote(i + 1, "19.00", 4), price }))),
    ).toEqual([]);
  });

  it("drops invalid IDs, deadlines, non-allowed carriers, missing names and provider errors", () => {
    const input = [
      quote(-1, 20, 4),
      quote(0, 20, 4),
      quote(2, 20, -1),
      quote(3, 20, 3.5),
      quote(4, 20, 366),
      { ...quote(5, 20, 4), company: { name: "Other Express" } },
      { ...quote(6, 20, 4), name: " " },
      { ...quote(7, 20, 4), error: "unavailable" },
      null,
      "broken",
    ];
    expect(normalizeShippingQuotes(input)).toEqual([]);
  });

  it("keeps one quote per shipping service, choosing its cheapest valid offer", () => {
    expect(
      normalizeShippingQuotes([
        quote(10, "28.90", 4),
        quote(10, "24.90", 5),
        quote(10, "24.90", 3),
        quote(11, "32.00", 2),
      ]),
    ).toEqual([
      { id: 10, name: "PAC", company: "Correios", price: 24.9, days: 3 },
      { id: 11, name: "PAC", company: "Correios", price: 32, days: 2 },
    ]);
  });

  it("rejects a structurally invalid provider response", () => {
    expect(() => normalizeShippingQuotes({ data: [] })).toThrow("Resposta de frete inválida");
  });
});

describe("carrier request validation does not create misleading shipping charges", () => {
  it("passes a validated package and postal codes, with an eight-second network timeout", async () => {
    const result = await calculateShipping("01310-100", [
      { id: "kit-banana-e-mel", unitPrice: 154.9, quantity: 2 },
    ]);
    expect(result).toMatchObject([{ id: 1, price: 25.9, days: 5 }]);
    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, init] = mocks.fetch.mock.calls[0]!;
    expect(url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toMatchObject({
      from: { postal_code: "30140010" },
      to: { postal_code: "01310100" },
      products: [
        {
          id: "kit-banana-e-mel",
          quantity: 2,
          width: 16,
          height: 12,
          length: 22,
          weight: 0.6,
          insurance_value: 154.9,
        },
      ],
    });
  });

  it("rejects invalid package dimensions before making a carrier request", async () => {
    for (const invalid of ["0", "-1", "not-a-number", "Infinity", "201"]) {
      mocks.values["MELHORENVIO_PKG_WIDTH_CM"] = invalid;
      await expect(
        calculateShipping("01310100", [{ id: "kit", unitPrice: 20, quantity: 1 }]),
      ).rejects.toThrow("Medidas de embalagem inválidas");
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid CEPs, quantity and product price before external API side effects", async () => {
    for (const postcode of ["1234567", "123456789", "", "0a1310100"]) {
      await expect(
        calculateShipping(postcode, [{ id: "kit", unitPrice: 20, quantity: 1 }]),
      ).rejects.toThrow("CEP inválido");
    }
    for (const item of [
      { id: "kit", unitPrice: -5, quantity: 1 },
      { id: "kit", unitPrice: NaN, quantity: 1 },
      { id: "kit", unitPrice: 20, quantity: 0 },
      { id: "kit", unitPrice: 20, quantity: 1.5 },
    ]) {
      await expect(calculateShipping("01310100", [item])).rejects.toThrow("Itens inválidos");
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not reveal provider response text when a carrier rejects the request", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("sensitive remote payload", { status: 503 }));
    await expect(
      calculateShipping("01310100", [{ id: "kit", unitPrice: 20, quantity: 1 }]),
    ).rejects.toThrow("Melhor Envio HTTP 503");
  });

  it("rejects malformed and empty monetary values despite a provider HTTP 200", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json([quote(1, "-2.00", 4), quote(2, "NaN", 5)]));
    expect(
      await calculateShipping("01310100", [{ id: "kit", unitPrice: 20, quantity: 1 }]),
    ).toEqual([]);
  });
});
