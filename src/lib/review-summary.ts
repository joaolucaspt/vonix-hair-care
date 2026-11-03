import { useEffect, useState } from "react";
import { reviewSummary } from "@/lib/reviews.functions";

/**
 * Notas das avaliações de visitantes (aprovadas, vindas do banco) por produto: [quantidade, soma das notas].
 * Carrega uma vez por visita e todos os cartões usam o mesmo resultado, para as estrelas refletirem as avaliações novas.
 */
type Summary = Record<string, [number, number]>;
let cache: Summary | null = null;
let loading = false;
const subs = new Set<() => void>();

function load() {
  if (cache || loading || typeof window === "undefined") return;
  loading = true;
  reviewSummary()
    .then((r) => {
      cache = r.summary;
    })
    .catch(() => {
      cache = {};
    })
    .finally(() => {
      loading = false;
      subs.forEach((f) => f());
    });
}

/** Soma uma avaliação recém-publicada ao resumo (sem esperar recarregar a página). */
export function addToSummary(slug: string, rating: number) {
  const cur = cache?.[slug] ?? [0, 0];
  cache = { ...(cache ?? {}), [slug]: [cur[0] + 1, cur[1] + rating] };
  subs.forEach((f) => f());
}

export function useVisitorSummary(): Summary {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    load();
    return () => {
      subs.delete(f);
    };
  }, []);
  return cache ?? {};
}
