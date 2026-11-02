import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";

/**
 * Retorno da autorização do app no Bling (OAuth). O Bling devolve ?code=...&state=vonix;
 * aqui o código vira o refresh token, mostrado uma única vez para você cadastrar no Lovable
 * como BLING_REFRESH_TOKEN. Nada é guardado nem escrito no log.
 */
const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{font:16px/1.5 "Inter",system-ui,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#1c1712}pre{white-space:pre-wrap;word-break:break-all;background:#f6f1e6;padding:1rem;border-radius:12px}</style></head><body>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export const Route = createFileRoute("/api/public/bling/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        if (!code || url.searchParams.get("state") !== "vonix") return page("Bling", "<h1>Link inválido</h1><p>Abra a autorização pelo painel do Bling.</p>", 400);
        const id = env("BLING_CLIENT_ID");
        const secret = env("BLING_CLIENT_SECRET");
        if (!id || !secret) return page("Bling", "<h1>Faltam as chaves</h1><p>Cadastre BLING_CLIENT_ID e BLING_CLIENT_SECRET nos Secrets do Lovable e autorize de novo.</p>", 500);
        try {
          const res = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
            method: "POST",
            headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "1.0" },
            body: new URLSearchParams({ grant_type: "authorization_code", code }),
          });
          if (!res.ok) {
            // Mostra só o tipo do erro (nunca chaves) para saber se o problema é o secret ou o código.
            const e = (await res.json().catch(() => ({}))) as { error?: { type?: string }; error_description?: string };
            const tipo = String(e.error?.type ?? e.error_description ?? res.status).replace(/[^\w .:-]/g, "").slice(0, 60);
            return page("Bling", `<h1>O Bling recusou o código</h1><p>Motivo: <b>${tipo}</b> (HTTP ${res.status}).</p><p>Ele vale poucos minutos e só uma vez. Autorize o app de novo.</p>`, 400);
          }
          const j = (await res.json()) as { refresh_token?: string };
          if (!j.refresh_token) return page("Bling", "<h1>Sem token na resposta</h1>", 502);
          return page(
            "Bling conectado",
            `<h1>Bling conectado</h1><p>Copie o valor abaixo e cadastre no Lovable (Settings &gt; Secrets) como <b>BLING_REFRESH_TOKEN</b>. Ele aparece só nesta tela.</p><pre>${j.refresh_token}</pre>`,
          );
        } catch {
          return page("Bling", "<h1>Não consegui falar com o Bling</h1><p>Tente de novo em alguns minutos.</p>", 502);
        }
      },
    },
  },
});
