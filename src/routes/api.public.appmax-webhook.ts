import { createFileRoute } from "@tanstack/react-router";
import { parseOrderEvent } from "@/lib/order-events";
import { env } from "@/lib/env.server";
import { BodyLimitError, readTextBounded } from "@/lib/bounded-http-body";
import { enqueueOrder } from "@/lib/order-outbox.server";

/** Appmax has no HMAC: never trust the event status, only enqueue the ID.
 * The protected worker queries the authoritative Appmax order before dispatching.
 * Appmax expects a response within 5 seconds; no ERP calls occur here.
 */
export async function receiveAppmaxWebhook(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = JSON.parse(await readTextBounded(request)) as unknown;
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return new Response(error.kind === "too_large" ? "payload too large" : "request timeout", {
        status: error.kind === "too_large" ? 413 : 408,
      });
    }
    return new Response("invalid json", { status: 400 });
  }
  // Appmax does not sign webhooks. Bind their envelope to the authorized store
  // and verify the actual paid/fulfillment status again via its merchant API.
  const expectedSite = env("APPMAX_WEBHOOK_SITE_ID");
  if (!expectedSite) return new Response("webhook not configured", { status: 503 });
  const envelope =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!envelope || envelope["event_type"] !== "order" || envelope["site_id"] !== expectedSite) {
    return new Response("unrecognized merchant event", { status: 403 });
  }
  const expectedApp = env("APPMAX_WEBHOOK_APP_ID");
  if (expectedApp && envelope["app_id"] !== expectedApp) {
    return new Response("unrecognized application", { status: 403 });
  }
  const event = parseOrderEvent(payload);
  if (!event) {
    // Ignore unrelated notifications without querying Appmax.
    const name =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>)["event"] : null;
    return new Response(
      typeof name === "string" && name.startsWith("order_") ? "invalid order" : "ignored",
      {
        status: typeof name === "string" && name.startsWith("order_") ? 400 : 200,
      },
    );
  }
  try {
    await enqueueOrder(event.orderId, event.event); // durable unique key, human-review flags for later reversals
    return new Response("queued", { status: 202 });
  } catch {
    // Do not acknowledge a failed durable write. Appmax retries non-2xx replies.
    return new Response("temporarily unavailable", { status: 503 });
  }
}

export const Route = createFileRoute("/api/public/appmax-webhook")({
  server: { handlers: { POST: ({ request }) => receiveAppmaxWebhook(request) } },
});
