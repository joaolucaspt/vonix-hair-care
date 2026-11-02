import { createFileRoute } from "@tanstack/react-router";
import * as appmax from "@/lib/appmax.server";
import * as bling from "@/lib/bling.server";

/**
 * Appmax webhooks carry no signature, so the payload is never trusted:
 * the order is re-read from the Appmax API before anything is logged as paid.
 * Retries and duplicates are expected, so this handler is idempotent.
 */
export const Route = createFileRoute("/api/public/appmax-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { event?: string; data?: { order_id?: number } };
          const orderId = Number(body.data?.order_id);
          if (body.event && Number.isInteger(orderId) && orderId > 0 && body.event.startsWith("order_")) {
            const order = await appmax.getOrder(orderId);
            console.log("[appmax-webhook]", body.event, orderId, order.data.order.status, appmax.isPaid(order) ? "PAGO" : "pendente");
            if (appmax.isPaid(order)) {
              try {
                console.log("[bling]", orderId, await bling.sendPaidOrder(order));
              } catch (e) {
                console.error("[bling]", e);
              }
            }
          }
        } catch (e) {
          console.error("[appmax-webhook]", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
