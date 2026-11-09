import { createFileRoute } from "@tanstack/react-router";
import { sendMetaEvent } from "@/lib/meta-capi.server";
import { BodyLimitError, readTextBounded } from "@/lib/bounded-http-body";

type Body = {
  event?: unknown;
  eventId?: unknown;
  url?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  customData?: unknown;
};

// Public browser telemetry is NOT proof that a purchase was paid.
// Purchase events must originate from an authenticated Appmax status.
const PUBLIC_EVENTS = new Set(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Lead"]);

export async function receiveMetaEvent(request: Request): Promise<Response> {
  let body: Body;
  try {
    const parsed: unknown = JSON.parse(await readTextBounded(request, 16_384, 1000));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return new Response(null, { status: 400 });
    body = parsed as Body;
  } catch (error) {
    if (error instanceof BodyLimitError)
      return new Response(null, { status: error.kind === "too_large" ? 413 : 408 });
    return new Response(null, { status: 400 });
  }

  if (body.event === "Purchase") return new Response(null, { status: 403 });
  if (
    typeof body.event !== "string" ||
    !PUBLIC_EVENTS.has(body.event) ||
    typeof body.eventId !== "string" ||
    body.eventId.length < 1 ||
    body.eventId.length > 120 ||
    typeof body.url !== "string" ||
    body.url.length > 2048
  )
    return new Response(null, { status: 400 });

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    await sendMetaEvent({
      event: body.event,
      eventId: body.eventId,
      url: body.url,
      fbp: typeof body.fbp === "string" ? body.fbp : undefined,
      fbc: typeof body.fbc === "string" ? body.fbc : undefined,
      customData:
        typeof body.customData === "object" && body.customData && !Array.isArray(body.customData)
          ? (body.customData as Record<string, unknown>)
          : undefined,
      ip: ip || undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export const Route = createFileRoute("/api/public/meta-event")({
  server: { handlers: { POST: ({ request }) => receiveMetaEvent(request) } },
});
