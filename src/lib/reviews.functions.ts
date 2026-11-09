import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { env } from "./env.server";
import { moderate } from "./review-moderation";
import { countRecent, dbEnabled, insertReview, listApproved, summaryApproved } from "./reviews.server";
import { getProduct } from "./store";

const reviewSchema = z.object({
  slug: z.string().min(1).max(120),
  nome: z.string().trim().min(2).max(60),
  nota: z.number().int().min(1).max(5),
  comentario: z.string().trim().min(10).max(600),
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  /** Campo-isca escondido: gente de verdade não preenche, robô preenche. */
  empresa: z.string().max(200).optional(),
});

export type PublicReview = { author: string; rating: number; comment: string; date: string };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
/** Impressão anônima da rede de quem enviou (para limitar abuso) — o IP em si não é guardado. */
async function ipHash() {
  const ip = (getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for") || "sem-ip").split(",")[0]!.trim();
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${env("REVIEW_SALT", "vonix")}`)));
}

/**
 * Avaliação enviada por qualquer visitante (comprou ou não).
 * - Com banco (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): passa pela conferência automática; se passar, aparece NA HORA;
 *   se levantar suspeita (link, telefone, palavrão, propaganda) fica pendente até o dono liberar.
 * - Limites: 3 avaliações por hora por rede e 1 por produto por dia, contra spam.
 * - Sem banco: vai para REVIEW_WEBHOOK_URL (ou LEAD_WEBHOOK_URL) para aprovação manual; sem nada, só aparece no log.
 */
export const submitReview = createServerFn({ method: "POST" })
  .inputValidator(reviewSchema)
  .handler(async ({ data }) => {
    if (data.empresa) return { ok: true as const, publicada: false, review: null }; // robô: finge que deu certo e descarta
    if (!getProduct(data.slug)) throw new Error("Produto não encontrado");
    const veredito = moderate(data.nome, data.comentario);

    if (dbEnabled()) {
      const hash = await ipHash();
      const hora = new Date(Date.now() - 3600e3).toISOString();
      const dia = new Date(Date.now() - 24 * 3600e3).toISOString();
      if ((await countRecent(hash, hora)) >= 3) return { ok: false as const, motivo: "Muitas avaliações em pouco tempo. Tente de novo mais tarde." };
      if ((await countRecent(hash, dia, data.slug)) >= 1) return { ok: false as const, motivo: "Você já avaliou este produto hoje. Obrigado!" };
      const [row] = await insertReview({ slug: data.slug, nome: data.nome, nota: data.nota, comentario: data.comentario, email: data.email ?? null, status: veredito.status, ip_hash: hash });
      const publicada = veredito.status === "aprovada";
      return {
        ok: true as const,
        publicada,
        review: publicada && row ? ({ author: row.nome, rating: row.nota, comment: row.comentario, date: row.criado_em.slice(0, 10) } satisfies PublicReview) : null,
      };
    }

    // Plano B, sem banco: aprovação manual pelo webhook (ou só log).
    const review = { origem: "avaliacao-site", produto: data.slug, nome: data.nome, nota: data.nota, comentario: data.comentario, email: data.email ?? "", conferencia: veredito.status, em: new Date().toISOString() };
    const url = env("REVIEW_WEBHOOK_URL") || env("LEAD_WEBHOOK_URL");
    if (!url) {
      // Never log visitors' names, emails or review text.
      return { ok: false as const, publicada: false, review: null, motivo: "Avaliações temporariamente indisponíveis. Tente mais tarde." };
    }
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(review), signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error("Webhook indisponível");
      return { ok: true as const, publicada: false, review: null };
    } catch (e) {
      // No PII is logged on delivery failures.
    }
    return { ok: false as const, publicada: false, review: null, motivo: "Não conseguimos receber sua avaliação agora. Tente novamente." };
  });

/** Avaliações de visitantes já aprovadas de um produto (vazio se o banco não estiver ligado). */
export const listReviews = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().min(1).max(120) }))
  .handler(async ({ data }): Promise<{ reviews: PublicReview[] }> => {
    if (!dbEnabled()) return { reviews: [] };
    try {
      const rows = await listApproved(data.slug);
      return { reviews: rows.map((r) => ({ author: r.nome, rating: r.nota, comment: r.comentario, date: r.criado_em.slice(0, 10) })) };
    } catch (e) {
      console.error("[avaliacoes] listar falhou", e);
      return { reviews: [] };
    }
  });

/** Contagem e soma das notas aprovadas por produto, para as estrelas dos cartões. */
export const reviewSummary = createServerFn({ method: "GET" }).handler(async (): Promise<{ summary: Record<string, [number, number]> }> => {
  if (!dbEnabled()) return { summary: {} };
  try {
    return { summary: await summaryApproved() };
  } catch (e) {
    console.error("[avaliacoes] resumo falhou", e);
    return { summary: {} };
  }
});
