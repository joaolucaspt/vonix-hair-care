import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import { getOrderHealth } from "@/lib/order-health.server";

function authorized(request: Request): boolean {
  const expected = env("ORDER_MONITOR_SECRET");
  const supplied = request.headers.get("authorization");
  // Deliberately separate from ORDER_WORKER_SECRET and never readable in the browser.
  if (!expected || expected.length < 32 || !supplied?.startsWith("Bearer ")) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied.slice(7));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function receiveOrderHealth(request: Request): Promise<Response> {
  const headers = {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  };
  if (!authorized(request))
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers,
    });
  try {
    const result = await getOrderHealth();
    return Response.json(result, { headers });
  } catch {
    return new Response(JSON.stringify({ error: "monitor unavailable" }), { status: 503, headers });
  }
}

export const Route = createFileRoute("/api/internal/order-health")({
  server: { handlers: { POST: ({ request }) => receiveOrderHealth(request) } },
});
