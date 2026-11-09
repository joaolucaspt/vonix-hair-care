import { createFileRoute } from "@tanstack/react-router";
import { sendMetaEvent } from "@/lib/meta-capi.server";

type Body = {
  event?: unknown;
  eventId?: unknown;
  url?: unknown;
  fbp?: unknown;
  fbc?: unknown;
  customData?: unknown;
};

export const Route = createFileRoute("/api/public/meta-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response(null, { status: 400 });
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
        await sendMetaEvent({
          event: String(body.event ?? ""),
          eventId: String(body.eventId ?? "").slice(0, 120),
          url: String(body.url ?? ""),
          fbp: typeof body.fbp === "string" ? body.fbp : undefined,
          fbc: typeof body.fbc === "string" ? body.fbc : undefined,
          customData:
            typeof body.customData === "object" && body.customData
              ? (body.customData as Record<string, unknown>)
              : undefined,
          ip,
          userAgent: request.headers.get("user-agent") ?? undefined,
        });

        return new Response(null, { status: 204 });
      },
    },
  },
});
