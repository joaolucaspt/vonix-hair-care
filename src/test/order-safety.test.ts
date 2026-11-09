import { describe, expect, it, vi } from "vitest";
import { isPaid, isReadyForFulfillment, type AppmaxOrder } from "@/lib/appmax.server";
import { parseOrderEvent, isTerminatedOrder } from "@/lib/order-events";
import { appmaxCentsToBrl } from "@/lib/bling.server";

function appmaxOrder(status: string): AppmaxOrder {
  return { data: { order: { id: 12, status } } };
}

describe("Appmax payment stages", () => {
  it.each([
    "pendente",
    "autorizado",
    "estornado",
    "cancelado",
    "recusado_por_risco",
    "chargeback_em_disputa",
    "pendente_integracao_em_analise",
  ])("never recognizes %s as a confirmed payment", (status) => {
    expect(isPaid(appmaxOrder(status))).toBe(false);
    expect(isReadyForFulfillment(appmaxOrder(status))).toBe(false);
  });
  it.each(["aprovado", "integrado", "pendente_integracao"])(
    "recognizes confirmed payment %s",
    (status) => expect(isPaid(appmaxOrder(status))).toBe(true),
  );
  it("fulfills only integrado, not autorizado or aprovado", () => {
    expect(isReadyForFulfillment(appmaxOrder("integrado"))).toBe(true);
    expect(isReadyForFulfillment(appmaxOrder("aprovado"))).toBe(false);
    expect(isReadyForFulfillment(appmaxOrder("autorizado"))).toBe(false);
  });
});

describe("webhooks are untrusted IDs, not payment evidence", () => {
  it("accepts official data.order.id and legacy order_id", () => {
    expect(parseOrderEvent({ event: "order_integrated", data: { order: { id: 501 } } })).toEqual({
      event: "order_integrated",
      orderId: 501,
    });
    expect(parseOrderEvent({ event: "order_paid_by_pix", data: { order_id: 502 } })).toEqual({
      event: "order_paid_by_pix",
      orderId: 502,
    });
  });
  it.each(["order_pending_integration", "order_refused_by_risk", "order_chargeback_in_treatment"])(
    "accepts the documented %s event for reconciliation or manual review",
    (event) => {
      expect(parseOrderEvent({ event, data: { order_id: 503 } })).toEqual({ event, orderId: 503 });
    },
  );
  it.each([
    null,
    {},
    { event: "order_paid", data: { order: { id: -1 } } },
    { event: "order_paid", data: { id: "2; DROP" } },
    { event: "customer_created", data: { id: 10 } },
  ])("does not enqueue malformed payloads %#", (data) => expect(parseOrderEvent(data)).toBeNull());
  it("recognizes terminal states without dispatching to an ERP", () => {
    expect(isTerminatedOrder("estornado")).toBe(true);
    expect(isTerminatedOrder("integrado")).toBe(false);
  });
});

describe("Appmax cents to Bling BRL", () => {
  it.each([
    [15490, 154.9],
    [123, 1.23],
    [0, 0],
    [1, 0.01],
  ])("converts %i cents to %f reais", (raw, expected) =>
    expect(appmaxCentsToBrl(raw)).toBe(expected),
  );
  it.each([-1, 12.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid cents %s", (value) =>
    expect(() => appmaxCentsToBrl(value)).toThrow(),
  );
});
