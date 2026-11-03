import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "./env.server";
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

/**
 * Avaliação enviada por qualquer visitante (comprou ou não). Ela NÃO aparece no site na hora: vai para o
 * REVIEW_WEBHOOK_URL (ou LEAD_WEBHOOK_URL), onde o dono aprova; as aprovadas entram em src/data/reviews.json
 * com "origem": "visitante". Sem webhook configurado ela só aparece no log do servidor, então configure um.
 */
export const submitReview = createServerFn({ method: "POST" })
  .inputValidator(reviewSchema)
  .handler(async ({ data }) => {
    if (data.empresa) return { ok: true as const }; // robô: finge que deu certo e descarta
    if (!getProduct(data.slug)) throw new Error("Produto não encontrado");
    const review = {
      origem: "avaliacao-site",
      produto: data.slug,
      nome: data.nome,
      nota: data.nota,
      comentario: data.comentario,
      email: data.email ?? "",
      em: new Date().toISOString(),
    };
    const url = env("REVIEW_WEBHOOK_URL") || env("LEAD_WEBHOOK_URL");
    if (!url) {
      console.info("[avaliacao]", JSON.stringify(review));
      return { ok: true as const };
    }
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(review),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`webhook respondeu ${r.status}`);
    } catch (e) {
      console.error("[avaliacao] webhook falhou", e, JSON.stringify(review));
    }
    return { ok: true as const };
  });
