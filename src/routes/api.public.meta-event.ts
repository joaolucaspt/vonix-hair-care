import { createFileRoute } from "@tanstack/react-router";
import { sendMetaEvent } from "@/lib/meta-capi.server";
import { BodyLimitError, readTextBounded } from "@/lib/bounded-http-body";
import { SITE_URL } from "@/lib/store";
import { isIP } from "node:net";
import { z } from "zod";

type Body = {
  event?: unknown;
  eventId?: unknown;
  url?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  customData?: unknown;
  consent?: unknown;
};

// Public browser telemetry is NOT proof that a purchase was paid.
// Purchase events must originate from an authenticated Appmax status.
const PUBLIC_EVENTS = new Set(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Lead"]);
// Never forward arbitrary nested browser JSON to the third-party Graph API.
const id = z.string().min(1).max(120);
const customDataSchema = z.object({
  currency: z.literal("BRL").optional(),
  value: z.number().finite().min(0).max(1_000_000).optional(),
  content_type: z.literal("product").optional(),
  content_ids: z.array(id).max(40).optional(),
  contents: z.array(z.object({
    id,
    quantity: z.number().int().min(1).max(500),
    item_price: z.number().finite().min(0).max(1_000_000),
  }).strict()).max(40).optional(),
  num_items: z.number().int().min(0).max(500).optional(),
}).strict();

export async function receiveMetaEvent(request: Request): Promise<Response> {
  // Browser telemetry must originate from our storefront. Header-based
  // checks are defense in depth, not independently verified legal consent.
  const site = new URL(SITE_URL).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    (origin !== null && origin !== site) ||
    (fetchSite !== null && fetchSite !== "same-origin") ||
    (!origin && fetchSite !== "same-origin")
  ) return new Response(null, { status: 403 });

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
  if (body.consent !== true) return new Response(null, { status: 403 });
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

  try {
    if (new URL(body.url).origin !== site) return new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 400 });
  }

  const customData = body.customData === undefined
    ? undefined : customDataSchema.safeParse(body.customData);
  if (customData !== undefined && !customData.success)
    return new Response(null, { status: 400 });

  const ip = request.headers.get("cf-connecting-ip")?.trim();
  try {
    await sendMetaEvent({
      event: body.event,
      eventId: body.eventId,
      url: body.url,
      fbp: typeof body.fbp === "string" ? body.fbp : undefined,
      fbc: typeof body.fbc === "string" ? body.fbc : undefined,
      customData: customData?.data,
      ip: ip && isIP(ip) ? ip : undefined,
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
