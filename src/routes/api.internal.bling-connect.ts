import { createFileRoute } from "@tanstack/react-router";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";

const html = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Bling — autorização Vonix</title></head><body style="font:16px system-ui;margin:3rem auto;max-width:35rem;padding:1rem">${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-frame-options": "DENY",
      },
    },
  );
const same = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function beginBlingOAuth(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return new Response("too large", { status: 413 });
  const form = await request.formData().catch(() => null);
  const password = form?.get("setup_secret");
  const secret = env("BLING_SETUP_SECRET");
  if (!secret || secret.length < 32 || typeof password !== "string" || !same(password, secret))
    return html("<h1>Autorização negada</h1>", 401);
  const id = env("BLING_CLIENT_ID");
  if (!id) return html("<h1>BLING_CLIENT_ID não configurado</h1>", 503);
  const state = randomBytes(24).toString("base64url");
  const url = new URL("https://www.bling.com.br/Api/v3/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", id);
  url.searchParams.set("state", state);
  const redirectUri = env("BLING_REDIRECT_URI");
  if (redirectUri) url.searchParams.set("redirect_uri", redirectUri);
  return new Response(null, {
    status: 303,
    headers: {
      location: url.toString(),
      "set-cookie": `vonix_bling_oauth_state=${state}; Max-Age=600; Path=/api/public/bling/callback; HttpOnly; Secure; SameSite=Lax`,
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/internal/bling-connect")({
  server: {
    handlers: {
      GET: () =>
        html(
          '<h1>Conectar Bling</h1><p>Acesso restrito ao proprietário. Digite o segredo de configuração de uso único ou rotativo.</p><form method="post"><label>Segredo administrativo <input name="setup_secret" type="password" autocomplete="off" required></label><button type="submit">Autorizar Bling</button></form>',
        ),
      POST: ({ request }) => beginBlingOAuth(request),
    },
  },
});
