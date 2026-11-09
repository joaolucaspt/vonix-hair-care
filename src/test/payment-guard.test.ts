import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  createOrder: vi.fn(),
  calculateShipping: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (handler: unknown) => handler }),
    handler: (handler: unknown) => handler,
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/lib/env.server", () => ({ env: () => "configured-test-only" }));
vi.mock("@/lib/appmax.server", () => ({
  createCustomer: mocks.createCustomer,
  createOrder: mocks.createOrder,
}));
vi.mock("@/lib/melhorenvio.server", () => ({ calculateShipping: mocks.calculateShipping }));
vi.mock("@/lib/affiliate-notify.server", () => ({ notifyAffiliateSale: vi.fn() }));

import { createPayment } from "@/lib/checkout.functions";

beforeEach(() => vi.clearAllMocks());

describe("pagamento sem token do cartão", () => {
  it("não cria cliente ou pedido na Appmax quando a tokenização não retornou token", async () => {
    const result = await createPayment({
      data: {
        customer: {
          nome: "Pessoa de Teste",
          email: "teste@example.com",
          cpf: "52998224725",
          whatsapp: "31999999999",
        },
        address: {
          cep: "30140010",
          rua: "Rua Exemplo",
          numero: "10",
          bairro: "Centro",
          cidade: "Belo Horizonte",
          uf: "MG",
        },
        items: [{ slug: "kit-banana-e-mel", variant: "Kit", qty: 1 }],
        serviceId: 1,
        method: "card",
      },
    });
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining("validar o cartão"),
    });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.calculateShipping).not.toHaveBeenCalled();
  });
});
