import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import { readBlingRefreshToken, rotateBlingRefreshToken } from "@/lib/bling-refresh.server";

/** OAuth authorization callback. Never render or log access/refresh tokens. */
const clearCookie =
  "vonix_bling_oauth_state=; Max-Age=0; Path=/api/public/bling/callback; HttpOnly; Secure; SameSite=Lax";
function page(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bling — Vonix</title></head><body style="font:16px system-ui;max-width:40rem;margin:3rem auto;padding:1rem">${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": clearCookie,
        "x-frame-options": "DENY",
      },
    },
  );
}
function verifyState(request: Request, value: string | null) {
  if (!value || value.length > 100) return false;
  const cookies = (request.headers.get("cookie") ?? "").split(";").map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith("vonix_bling_oauth_state="));
  const cookie = found?.slice("vonix_bling_oauth_state=".length) ?? "";
  const a = Buffer.from(value);
  const b = Buffer.from(cookie);
  return a.length === b.length && a.length === 32 && timingSafeEqual(a, b);
}

export async function receiveBlingCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Browser-bound HttpOnly one-time state (set only after admin authorization).
  if (!verifyState(request, url.searchParams.get("state")))
    return page("<h1>Autorização inválida ou expirada</h1>", 400);
  const code = url.searchParams.get("code");
  if (!code || code.length > 1000) return page("<h1>Código do Bling ausente</h1>", 400);
  const id = env("BLING_CLIENT_ID");
  const secret = env("BLING_CLIENT_SECRET");
  if (!id || !secret) return page("<h1>Integração ainda não configurada</h1>", 503);
  try {
    const result = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        Accept: "1.0",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok)
      return page(
        "<h1>O Bling não autorizou a conexão</h1><p>Tente iniciar a autorização novamente.</p>",
        502,
      );
    const json = (await result.json()) as { refresh_token?: unknown };
    if (typeof json.refresh_token !== "string")
      return page("<h1>Resposta incompleta do Bling</h1>", 502);
    // Persist server-side; no secrets are ever sent to the browser.
    let current: string | null;
    try {
      current = await readBlingRefreshToken();
    } catch {
      current = null;
    }
    await rotateBlingRefreshToken(current, json.refresh_token);
    return page(
      "<h1>Conexão com Bling registrada</h1><p>A credencial foi salva com segurança no servidor.</p>",
    );
  } catch {
    return page(
      "<h1>Não foi possível salvar a conexão</h1><p>Confira a configuração da integração e tente novamente.</p>",
      503,
    );
  }
}

export const Route = createFileRoute("/api/public/bling/callback")({
  server: { handlers: { GET: ({ request }) => receiveBlingCallback(request) } },
});
