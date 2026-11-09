import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import { recoverMetaPurchases } from "@/lib/meta-purchase-recovery.server";

/** Independent from Bling: a completed fulfillment outbox must not lose CAPI retries.
 * Separate high-entropy secret. No user data or order IDs in the response.
 */
function authorized(request: Request): boolean {
  const expected = env("META_RECOVERY_SECRET");
  const supplied = request.headers.get("authorization");
  if (!expected || expected.length < 32 || !supplied?.startsWith("Bearer ")) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied.slice(7));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function receiveMetaRecovery(request: Request): Promise<Response> {
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
    const result = await recoverMetaPurchases(2);
    return Response.json(result, { headers });
  } catch {
    // Never leak Supabase or Meta credentials/provider response bodies.
    return new Response(JSON.stringify({ error: "recovery unavailable" }), {
      status: 503,
      headers,
    });
  }
}

export const Route = createFileRoute("/api/internal/meta-recovery")({
  server: { handlers: { POST: ({ request }) => receiveMetaRecovery(request) } },
});
