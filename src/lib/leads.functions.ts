import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "./env.server";
import { SIGNUP_COUPON } from "./coupons";

const leadSchema = z.object({
  nome: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(160),
  /** Campo-isca escondido: gente de verdade não preenche, robô preenche. */
  empresa: z.string().max(200).optional(),
  /** WhatsApp (a lista VIP da Black Friday pede). O app guarda só dígitos e ignora número que não parece de telefone. */
  telefone: z.string().trim().max(25).optional(),
  /** De onde veio o cadastro. A lista VIP da Black Friday não ganha cupom: ganha o aviso em primeira mão. */
  origem: z.enum(["cadastro-site", "esquenta-black-friday"]).optional(),
});

/**
 * Cadastro no site: quem se cadastra ganha o cupom de boas-vindas (o cupom em si é entregue no navegador).
 * Aqui só guardamos o contato. Destino: LEAD_WEBHOOK_URL (planilha, Brevo, Zapier, Make...), que recebe um POST JSON.
 * Só confirma cadastro após o destino aceitar o contato; nunca registra dados pessoais em logs.
 */
export const registerLead = createServerFn({ method: "POST" })
  .inputValidator(leadSchema)
  .handler(async ({ data }) => {
    if (data.empresa)
      return { ok: false as const, saved: false, message: "Não foi possível concluir o cadastro." };
    const lead = {
      origem: data.origem ?? "cadastro-site",
      nome: data.nome ?? "",
      email: data.email,
      telefone: data.telefone ?? "",
      cupom: data.origem === "esquenta-black-friday" ? "" : SIGNUP_COUPON,
      em: new Date().toISOString(),
    };
    // Destinos: o app de expedição da Vonix (tela "Contatos do site") e, se existir, LEAD_WEBHOOK_URL (planilha, Brevo, Zapier...).
    // Basta um aceitar o contato para confirmar o cadastro.
    const appUrl = env("AFFILIATE_APP_URL");
    const appSecret = env("AFFILIATE_SITE_SECRET");
    const webhook = env("LEAD_WEBHOOK_URL");
    const destinos: { url: string; headers: Record<string, string> }[] = [];
    if (appUrl && appSecret) {
      destinos.push({
        url: `${appUrl.replace(/\/+$/, "")}/api/public/contatos`,
        headers: { "content-type": "application/json", authorization: `Bearer ${appSecret}` },
      });
    }
    if (webhook) destinos.push({ url: webhook, headers: { "content-type": "application/json" } });
    if (destinos.length === 0) {
      return {
        ok: false as const,
        saved: false,
        message: "O cadastro está indisponível no momento. Tente novamente mais tarde.",
      };
    }
    // Motivo da falha (só um código, sem dado pessoal): "http-401", "http-503", "rede"...
    const resultados = await Promise.all(
      destinos.map(async (d) => {
        try {
          const r = await fetch(d.url, { method: "POST", headers: d.headers, body: JSON.stringify(lead), signal: AbortSignal.timeout(6000) });
          return r.ok ? "ok" : `http-${r.status}`;
        } catch (e) {
          return e instanceof Error && e.name === "TimeoutError" ? "demorou" : "rede";
        }
      }),
    );
    if (resultados.includes("ok")) return { ok: true as const, saved: true };
    return {
      ok: false as const,
      saved: false,
      why: resultados.join(","),
      message: "Não foi possível salvar seu cadastro. Tente novamente em instantes.",
    };
  });
