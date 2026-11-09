import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import { processOrderOutbox } from "@/lib/order-outbox.server";

function authorized(request: Request): boolean {
  const secret = env("ORDER_WORKER_SECRET");
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function receiveOrderWorker(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  try {
    const result = await processOrderOutbox(3);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return new Response("worker unavailable", { status: 503 });
  }
}

export const Route = createFileRoute("/api/internal/order-worker")({
  server: { handlers: { POST: ({ request }) => receiveOrderWorker(request) } },
});
