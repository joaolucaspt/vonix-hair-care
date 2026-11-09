import { META_PIXEL_ID } from "@/lib/analytics";
import { env } from "@/lib/env.server";
import { SITE_URL } from "@/lib/store";

/** Eventos que o site já envia pelo pixel e que também vão pelo servidor (mesmo eventID = deduplicação). */
export const CAPI_EVENTS = new Set([
  "PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead",
]);

const CUSTOM_DATA_KEYS = ["currency", "value", "content_type", "content_ids", "contents", "num_items"] as const;

export type CapiInput = {
  event: string;
  eventId: string;
  url: string;
  fbp?: string | undefined;
  fbc?: string | undefined;
  customData?: Record<string, unknown> | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
};

const clean = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Envia um evento à API de Conversões da Meta. Sem token configurado, não faz nada. */
export async function sendMetaEvent(input: CapiInput): Promise<"sent" | "skipped" | "failed"> {
  const token = env("META_CAPI_TOKEN");
  if (!token) return "skipped";
  if (!CAPI_EVENTS.has(input.event) || !input.eventId) return "skipped";
  if (!input.url.startsWith(SITE_URL)) return "skipped";

  const customData: Record<string, unknown> = {};
  for (const key of CUSTOM_DATA_KEYS) {
    if (input.customData && key in input.customData) customData[key] = input.customData[key];
  }

  const payload = {
    data: [
      {
        event_name: input.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.url,
        action_source: "website",
        user_data: {
          ...(input.ip ? { client_ip_address: input.ip } : {}),
          ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
          ...(clean(input.fbp, 200) ? { fbp: clean(input.fbp, 200) } : {}),
          ...(clean(input.fbc, 300) ? { fbc: clean(input.fbc, 300) } : {}),
        },
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
    ...(env("META_TEST_EVENT_CODE") ? { test_event_code: env("META_TEST_EVENT_CODE") } : {}),
    access_token: token,
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
