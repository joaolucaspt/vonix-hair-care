/**
 * Deterministic, local-only commission scenario calculator.
 *
 * This module deliberately never reads real orders, Supabase, affiliate applicants
 * or checkout events. A "ref" is a hypothetical unverified label, NOT proof that
 * a customer was referred. The rate is a scenario parameter, not an approved fee.
 */
export type SimulationEventStatus = "pendente" | "pago" | "cancelado" | "estornado";
export interface SimulationEvent {
  orderId: string;
  ref: string;
  status: SimulationEventStatus;
  amountCents?: number;
}
export interface SimulationOrder {
  orderId: string;
  ref: string;
  amountCents: number;
  status: SimulationEventStatus;
  commissionCents: number;
  refundedCommissionCents: number;
}
export interface SimulationSummary {
  orders: SimulationOrder[];
  paidOrders: number;
  pendingOrders: number;
  reversedOrders: number;
  eligibleSalesCents: number;
  reversedSalesCents: number;
  estimatedCommissionCents: number;
  reversedCommissionCents: number;
  duplicateEvents: number;
  rejectedEvents: number;
}

export const simulationRefValid = (s: string) => /^[a-z0-9-]{1,30}$/.test(s);
export const simulationOrderIdValid = (s: string) => /^[a-zA-Z0-9_-]{1,40}$/.test(s);

export function calculateCommissionCents(amountCents: number, basisPoints: number): number {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 3000
  )
    throw new Error("Cenário inválido.");
  // BigInt avoids floating-point rounding and overflow in multiplication.
  const result = (BigInt(amountCents) * BigInt(basisPoints) + 5000n) / 10000n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Valor excessivo.");
  return Number(result);
}

export function simulateAffiliateCommissions(
  events: readonly SimulationEvent[],
  basisPoints: number,
): SimulationSummary {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 3000) {
    throw new Error("A taxa da simulação deve estar entre 0% e 30%.");
  }
  if (events.length > 500) throw new Error("Máximo de 500 eventos sintéticos.");
  const orders = new Map<
    string,
    Omit<SimulationOrder, "commissionCents" | "refundedCommissionCents"> & { everPaid: boolean }
  >();
  let duplicateEvents = 0;
  let rejectedEvents = 0;
  for (const ev of events) {
    if (
      !ev ||
      !simulationOrderIdValid(ev.orderId) ||
      !simulationRefValid(ev.ref) ||
      !["pendente", "pago", "cancelado", "estornado"].includes(ev.status) ||
      (ev.amountCents !== undefined &&
        (!Number.isSafeInteger(ev.amountCents) ||
          ev.amountCents <= 0 ||
          ev.amountCents > 500_000_000))
    ) {
      rejectedEvents++;
      continue;
    }
    const prior = orders.get(ev.orderId);
    // A source must create a *pending* order to establish attribution and amount.
    // Never accept paid/refund events with unknown ID: no inferred commission.
    if (!prior) {
      if (ev.status !== "pendente" || ev.amountCents === undefined) {
        rejectedEvents++;
        continue;
      }
      orders.set(ev.orderId, {
        orderId: ev.orderId,
        ref: ev.ref,
        amountCents: ev.amountCents,
        status: "pendente",
        everPaid: false,
      });
      continue;
    }
    if (
      ev.ref !== prior.ref ||
      (ev.amountCents !== undefined && ev.amountCents !== prior.amountCents)
    ) {
      // Ref/amount cannot be changed retroactively by another event.
      rejectedEvents++;
      continue;
    }
    if (ev.status === prior.status) {
      duplicateEvents++;
      continue;
    }
    const next =
      (prior.status === "pendente" && (ev.status === "pago" || ev.status === "cancelado")) ||
      (prior.status === "pago" && (ev.status === "estornado" || ev.status === "cancelado"));
    if (!next) {
      rejectedEvents++;
      continue;
    }
    if (ev.status === "pago") prior.everPaid = true;
    prior.status = ev.status;
  }
  const report: SimulationSummary = {
    orders: [],
    paidOrders: 0,
    pendingOrders: 0,
    reversedOrders: 0,
    eligibleSalesCents: 0,
    reversedSalesCents: 0,
    estimatedCommissionCents: 0,
    reversedCommissionCents: 0,
    duplicateEvents,
    rejectedEvents,
  };
  for (const order of orders.values()) {
    const commission = calculateCommissionCents(order.amountCents, basisPoints);
    const paid = order.status === "pago";
    const reversed = order.status === "estornado" || order.status === "cancelado";
    const wasPaidBeforeReversal = reversed && order.everPaid;
    const { everPaid: _wasPaid, ...publicOrder } = order;
    void _wasPaid;
    report.orders.push({
      ...publicOrder,
      commissionCents: paid ? commission : 0,
      refundedCommissionCents: wasPaidBeforeReversal ? commission : 0,
    });
    if (paid) {
      report.paidOrders++;
      report.eligibleSalesCents += order.amountCents;
      report.estimatedCommissionCents += commission;
    } else if (reversed) {
      report.reversedOrders++;
      if (wasPaidBeforeReversal) {
        report.reversedSalesCents += order.amountCents;
        report.reversedCommissionCents += commission;
      }
    } else report.pendingOrders++;
  }
  report.orders.sort((a, b) => a.orderId.localeCompare(b.orderId));
  return report;
}
