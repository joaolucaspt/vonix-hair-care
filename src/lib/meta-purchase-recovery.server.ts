import { env } from "./env.server";
import { getOrder, isPaid } from "./appmax.server";
import { isTerminatedOrder } from "./order-events";
import { sendVerifiedPurchase } from "./meta-capi.server";
import { dueMetaRecoveryOrders, deferMetaRecovery } from "./meta-purchase-delivery.server";

export type MetaRecoverySummary = {
  checked: number;
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
};

/** A small independent CAPI recovery pass.
 * It runs AFTER the ERP worker, including for completed Bling exports.
 * No real charge, refund or ERP write is performed here.
 */
export async function recoverMetaPurchases(limit = 3): Promise<MetaRecoverySummary> {
  const summary: MetaRecoverySummary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    deferred: 0,
    failed: 0,
  };
  // Do not mark events as delivered without a configured CAPI destination.
  if (!env("META_CAPI_TOKEN")) throw new Error("Meta CAPI não configurada");
  const ids = await dueMetaRecoveryOrders(limit);
  for (const id of ids) {
    summary.checked++;
    try {
      const order = await getOrder(id); // authoritative merchant API
      if (order.data.order.id !== id) {
        throw new Error("Appmax devolveu um ID diferente do pedido solicitado");
      }
      if (!isPaid(order)) {
        // Cancelled/refunded orders are rechecked less frequently, rather than
        // being misreported as purchases. Unresolved antifraud needs a shorter retry.
        await deferMetaRecovery(id, isTerminatedOrder(order.data.order.status) ? 1440 : 60);
        summary.deferred++;
        continue;
      }
      const result = await sendVerifiedPurchase(order);
      if (result === "sent") summary.sent++;
      else if (result === "skipped")
        summary.skipped++; // already sent or leased elsewhere
      else {
        await deferMetaRecovery(id, 15);
        summary.failed++;
      }
    } catch {
      // No customer PII, tokens or payment response details in worker output.
      try {
        await deferMetaRecovery(id, 15);
      } catch {
        /* retain the bounded DB lease */
      }
      summary.failed++;
    }
  }
  return summary;
}
