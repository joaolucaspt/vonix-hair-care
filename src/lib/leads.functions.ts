import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "./env.server";
import { SIGNUP_COUPON } from "./coupons";

const leadSchema = z.object({
  nome: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(160),
  /** Campo-isca escondido: gente de verdade não preenche, robô preenche. */
  empresa: z.string().max(200).optional(),
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
      origem: "cadastro-site",
      nome: data.nome ?? "",
      email: data.email,
      cupom: SIGNUP_COUPON,
      em: new Date().toISOString(),
    };
    const url = env("LEAD_WEBHOOK_URL");
    if (!url) {
      return {
        ok: false as const,
        saved: false,
        message: "O cadastro está indisponível no momento. Tente novamente mais tarde.",
      };
    }
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`webhook respondeu ${r.status}`);
      return { ok: true as const, saved: true };
    } catch {
      return {
        ok: false as const,
        saved: false,
        message: "Não foi possível salvar seu cadastro. Tente novamente em instantes.",
      };
    }
  });
