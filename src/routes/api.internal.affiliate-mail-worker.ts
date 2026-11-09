import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";
import { secureEqual, processAffiliateEmails } from "@/lib/affiliate-applications.server";

export async function receiveAffiliateMailWorker(request: Request): Promise<Response> {
  const secret = env("AFFILIATE_WORKER_SECRET");
  const header = request.headers.get("authorization");
  if (
    !secret ||
    secret.length < 24 ||
    !header?.startsWith("Bearer ") ||
    !secureEqual(header.slice(7), secret)
  ) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const result = await processAffiliateEmails(5);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return new Response("worker unavailable", { status: 503 });
  }
}

export const Route = createFileRoute("/api/internal/affiliate-mail-worker")({
  server: { handlers: { POST: ({ request }) => receiveAffiliateMailWorker(request) } },
});
