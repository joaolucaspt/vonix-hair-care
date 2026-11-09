import { describe, expect, it } from "vitest";
import {
  calculateCommissionCents,
  simulateAffiliateCommissions,
  type SimulationEvent,
} from "@/lib/affiliate-commission-simulator";

const pending = (orderId: string, amountCents: number, ref = "marina"): SimulationEvent => ({
  orderId,
  amountCents,
  ref,
  status: "pendente",
});
const event = (
  orderId: string,
  status: SimulationEvent["status"],
  ref = "marina",
): SimulationEvent => ({
  orderId,
  status,
  ref,
});

describe("Vonix - apuração hipotética de comissões (nenhuma escrita real)", () => {
  it("nunca contabiliza comissão para venda ainda pendente", () => {
    const report = simulateAffiliateCommissions([pending("V001", 19990)], 1000);
    expect(report.pendingOrders).toBe(1);
    expect(report.eligibleSalesCents).toBe(0);
    expect(report.estimatedCommissionCents).toBe(0);
  });

  it("só reconhece comissão após evento pago vinculado a um pedido pendente", () => {
    const report = simulateAffiliateCommissions(
      [pending("V001", 19990), event("V001", "pago")],
      1000,
    );
    expect(report.paidOrders).toBe(1);
    expect(report.eligibleSalesCents).toBe(19990);
    expect(report.estimatedCommissionCents).toBe(1999);
  });

  it("é idempotente mesmo com webhooks duplicados de pagamento", () => {
    const report = simulateAffiliateCommissions(
      [
        pending("V001", 19990),
        pending("V001", 19990),
        event("V001", "pago"),
        event("V001", "pago"),
      ],
      1000,
    );
    expect(report.duplicateEvents).toBe(2);
    expect(report.estimatedCommissionCents).toBe(1999);
  });

  it("zera comissão vigente depois de estorno; identifica valor hipoteticamente revertido", () => {
    const report = simulateAffiliateCommissions(
      [
        pending("V001", 19990),
        event("V001", "pago"),
        event("V001", "estornado"),
        event("V001", "estornado"),
      ],
      1000,
    );
    expect(report.estimatedCommissionCents).toBe(0);
    expect(report.reversedCommissionCents).toBe(1999);
    expect(report.reversedSalesCents).toBe(19990);
    expect(report.duplicateEvents).toBe(1);
  });

  it("cancelamento anterior ao pagamento nunca cria comissão reversa", () => {
    const report = simulateAffiliateCommissions(
      [pending("V001", 19990), event("V001", "cancelado"), event("V001", "pago")],
      1000,
    );
    expect(report.estimatedCommissionCents).toBe(0);
    expect(report.reversedCommissionCents).toBe(0);
    expect(report.rejectedEvents).toBe(1);
  });

  it("impede troca retroativa de afiliada, ID sem prévia e adulteração de valor", () => {
    const report = simulateAffiliateCommissions(
      [
        event("V999", "pago"),
        pending("V001", 19990),
        event("V001", "pago", "outro-codigo"),
        { ...event("V001", "pago"), amountCents: 1 },
        event("V001", "pago"),
      ],
      1000,
    );
    expect(report.rejectedEvents).toBe(3);
    expect(report.estimatedCommissionCents).toBe(1999);
    expect(report.orders[0]?.ref).toBe("marina");
  });

  it("não credita pedidos com identificação/ref/valores inválidos", () => {
    const report = simulateAffiliateCommissions(
      [
        pending("V001", 0),
        pending("V002", -1),
        pending("V003", 500_000_001),
        pending("V004", 1000, "<script>"),
        pending("V005", 1000, "ana"),
      ],
      1000,
    );
    expect(report.rejectedEvents).toBe(4);
    expect(report.orders).toHaveLength(1);
    expect(report.estimatedCommissionCents).toBe(0);
  });

  it("calcula percentuais em inteiros sem erros de ponto flutuante", () => {
    expect(calculateCommissionCents(1005, 1000)).toBe(101);
    expect(calculateCommissionCents(999, 250)).toBe(25);
    expect(calculateCommissionCents(100, 0)).toBe(0);
    expect(calculateCommissionCents(100, 3000)).toBe(30);
    expect(() => calculateCommissionCents(100, 5000)).toThrow();
  });

  it("valida a taxa e limita número de eventos para simulações", () => {
    expect(() => simulateAffiliateCommissions([], -1)).toThrow();
    expect(() => simulateAffiliateCommissions([], 3001)).toThrow();
    expect(() => simulateAffiliateCommissions([], 5.2)).toThrow();
    expect(() => simulateAffiliateCommissions(Array(501).fill(pending("X", 100)), 1000)).toThrow();
  });

  it("não soma duplicidade de referências em pedidos diferentes, nem inventa valores", () => {
    const report = simulateAffiliateCommissions(
      [
        pending("V001", 10000, "ana"),
        event("V001", "pago", "ana"),
        pending("V002", 30000, "ana"),
        event("V002", "pago", "ana"),
        pending("V003", 40000, "joana"),
        event("V003", "pago", "joana"),
        event("V003", "estornado", "joana"),
      ],
      850,
    );
    expect(report.orders).toHaveLength(3);
    expect(report.eligibleSalesCents).toBe(40000);
    expect(report.estimatedCommissionCents).toBe(3400);
    expect(report.reversedCommissionCents).toBe(3400);
  });
});
