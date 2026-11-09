import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  env: (name: string) => (name === "APPMAX_ENV" ? "sandbox" : ""),
  requireEnv: (name: string) =>
    name === "APPMAX_CLIENT_ID"
      ? "client-test"
      : name === "APPMAX_CLIENT_SECRET"
        ? "secret-test"
        : (() => {
            throw new Error("Unconfigured test key");
          })(),
}));
import { assertAppmaxOrder, getOrder } from "@/lib/appmax.server";

const network = vi.fn();
const merchantOrder = (id: unknown, status: unknown) => ({
  data: { order: { id, status } },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", network);
  network.mockImplementation(async (input: string) =>
    String(input).includes("/oauth2/token")
      ? Response.json({ access_token: "token-for-tests", expires_in: 300 })
      : Response.json(merchantOrder(102, "integrado")),
  );
});

describe("Appmax authoritative order integrity", () => {
  it("rejects another order ID, even when the other order was paid", () => {
    expect(() => assertAppmaxOrder(merchantOrder(200, "integrado") as never, 102)).toThrow(
      "diferente do solicitado",
    );
  });

  it.each([
    merchantOrder("102", "integrado"),
    merchantOrder(null, "aprovado"),
    merchantOrder(102, null),
    merchantOrder(102, ""),
    merchantOrder(102, " "),
    merchantOrder(102, "a".repeat(101)),
    { data: { order: null } },
    { data: null },
    {},
    null,
  ])("fails closed on missing or malformed gateway identity/status", (payload) => {
    expect(() => assertAppmaxOrder(payload as never, 102)).toThrow("pedido inválido");
  });

  it("allows valid known IDs and nonpaid statuses to be handled by callers", () => {
    expect(() => assertAppmaxOrder(merchantOrder(102, "autorizado") as never, 102)).not.toThrow();
    expect(() => assertAppmaxOrder(merchantOrder(102, "integrado") as never, 102)).not.toThrow();
  });

  it("never contacts provider for unsafe order IDs", async () => {
    for (const id of [0, -1, Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(getOrder(id)).rejects.toThrow("Identificador");
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("queries only the requested ID and checks the authoritative response", async () => {
    const order = await getOrder(102);
    expect(order.data.order).toEqual({ id: 102, status: "integrado" });
    expect(
      network.mock.calls.some((call: unknown[]) => String(call[0]).endsWith("/v1/orders/102")),
    ).toBe(true);
  });

  it("does not accept a paid response for a different ID after a successful HTTP 200", async () => {
    network.mockImplementation(async (input: string) =>
      String(input).includes("/oauth2/token")
        ? Response.json({ access_token: "token-for-tests", expires_in: 300 })
        : Response.json(merchantOrder(103, "integrado")),
    );
    await expect(getOrder(102)).rejects.toThrow("diferente do solicitado");
  });

  it("rejects a malformed successful response rather than returning it as paid", async () => {
    network.mockImplementation(async (input: string) =>
      String(input).includes("/oauth2/token")
        ? Response.json({ access_token: "token-for-tests", expires_in: 300 })
        : Response.json({ data: { order: { id: 102 } } }),
    );
    await expect(getOrder(102)).rejects.toThrow("pedido inválido");
  });
});
