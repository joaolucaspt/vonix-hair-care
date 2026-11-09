import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/env.server", () => ({
  env: (name: string) =>
    name === "SUPABASE_URL"
      ? "https://test-db.example"
      : name === "SUPABASE_SERVICE_ROLE_KEY"
        ? "server-only-service-key-test"
        : "",
}));
import { claimMetaPurchase, acknowledgeMetaPurchase } from "@/lib/meta-purchase-delivery.server";

const token = "11111111-1111-4111-8111-111111111111";
const network = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", network);
});

describe("durable Meta Purchase delivery claims", () => {
  it("claims a single order with server-side service credentials", async () => {
    network.mockResolvedValueOnce(Response.json({ claimed: true, claimToken: token }));
    expect(await claimMetaPurchase(101)).toBe(token);
    expect(network).toHaveBeenCalledWith(
      "https://test-db.example/rest/v1/rpc/vonix_claim_meta_purchase",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "server-only-service-key-test",
          authorization: "Bearer server-only-service-key-test",
        }),
        body: JSON.stringify({ p_order_id: 101 }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not reacquire an already sent or currently leased event", async () => {
    network.mockResolvedValueOnce(Response.json({ claimed: false, claimToken: null }));
    expect(await claimMetaPurchase(101)).toBeNull();
  });

  it("acknowledges only its own valid lease", async () => {
    network.mockResolvedValueOnce(Response.json(true));
    await acknowledgeMetaPurchase(101, token);
    expect(network).toHaveBeenCalledWith(
      "https://test-db.example/rest/v1/rpc/vonix_ack_meta_purchase",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ p_order_id: 101, p_claim_token: token }),
      }),
    );
    network.mockResolvedValueOnce(Response.json(false));
    await expect(acknowledgeMetaPurchase(101, token)).rejects.toThrow("não persistida");
  });

  it("fails closed on malformed claims, invalid IDs and storage failures", async () => {
    network.mockResolvedValueOnce(Response.json({ claimed: true, claimToken: null }));
    await expect(claimMetaPurchase(101)).rejects.toThrow("sem token");
    network.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await expect(claimMetaPurchase(101)).rejects.toThrow("HTTP 503");
    await expect(claimMetaPurchase(0)).rejects.toThrow("Identificador");
    await expect(acknowledgeMetaPurchase(101, "not-a-uuid")).rejects.toThrow("inválida");
  });
});
