/**
 * Leitura do aviso (webhook) do Appmax.
 *
 * O Appmax manda o nome do evento em CamelCase ("OrderPaid") e o número do pedido em `data.id`.
 * O código antigo esperava "order_paid" e `data.order_id`, então os avisos reais eram ignorados.
 */

/** "OrderPaid", "order_paid" e "Order Paid" viram "order_paid". */
export const normalizeEvent = (raw: unknown): string =>
  typeof raw === "string"
    ? raw
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase()
    : "";

export type AppmaxWebhook = { event: string; orderId: number; data: Record<string, unknown> };

/** Devolve o evento normalizado e o número do pedido, ou null se o corpo não for um aviso do Appmax. */
export function parseAppmaxWebhook(body: unknown): AppmaxWebhook | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { event?: unknown; data?: unknown };
  const event = normalizeEvent(b.event);
  const data = b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : null;
  if (!event || !data) return null;
  const orderId = Number(data["id"] ?? data["order_id"]);
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  return { event, orderId, data };
}

/** Só o aviso "Pedido pago" libera a etiqueta; "Pedido aprovado" e "Pix pago" chegam juntos e não podem repetir a compra. */
export const isOrderPaidEvent = (event: string) => event === "order_paid";
