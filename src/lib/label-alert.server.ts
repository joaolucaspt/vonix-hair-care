import { env } from "./env.server";

/**
 * Aviso de problema com etiqueta (saldo baixo, compra que falhou, token sem permissão).
 * Sempre vai para o log do site; vira e-mail se RESEND_API_KEY e um remetente (LABEL_ALERT_FROM ou
 * AFFILIATE_FROM_EMAIL) existirem. O destinatário é LABEL_ALERT_EMAIL, ou STORE_EMAIL, ou o e-mail da loja do Appmax.
 * Nunca derruba o fluxo: se o aviso falhar, só vai para o log.
 */
export async function notifyLabelProblem(input: { orderId: number | null; title: string; lines: string[]; fallbackTo?: string }) {
  const body = input.lines.join("\n");
  console.error("[etiqueta][ALERTA]", input.orderId ?? "-", input.title, body);
  const key = env("RESEND_API_KEY");
  const from = env("LABEL_ALERT_FROM") || env("AFFILIATE_FROM_EMAIL");
  const to = env("LABEL_ALERT_EMAIL") || env("STORE_EMAIL") || input.fallbackTo || "";
  if (!key || !from || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: `[Vonix Hair] ${input.title}`, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error("[etiqueta][ALERTA] e-mail não enviado", e);
    return false;
  }
}
