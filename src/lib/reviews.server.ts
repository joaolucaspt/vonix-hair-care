import { env } from "./env.server";

/**
 * Banco das avaliações enviadas pelo site (tabela public.avaliacoes, veja supabase/avaliacoes.sql).
 * Usa a API REST do Supabase (o que o Lovable Cloud cria) com a chave de serviço, só no servidor.
 * Sem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o banco fica desligado e a avaliação cai no plano B (webhook/log).
 */
export const dbEnabled = () => Boolean(env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

export type AvaliacaoRow = { nome: string; nota: number; comentario: string; criado_em: string };

export const insertReview = (row: { slug: string; nome: string; nota: number; comentario: string; email: string | null; status: "aprovada" | "pendente"; ip_hash: string }) =>
  rest<AvaliacaoRow[]>("avaliacoes", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });

/** Quantas avaliações esse aparelho/rede já enviou desde `sinceIso` (opcionalmente só neste produto). */
export const countRecent = async (ipHash: string, sinceIso: string, slug?: string) => {
  const q = `avaliacoes?select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&criado_em=gte.${encodeURIComponent(sinceIso)}${slug ? `&slug=eq.${encodeURIComponent(slug)}` : ""}`;
  return (await rest<unknown[]>(q)).length;
};

export const listApproved = (slug: string) =>
  rest<AvaliacaoRow[]>(`avaliacoes?select=nome,nota,comentario,criado_em&slug=eq.${encodeURIComponent(slug)}&status=eq.aprovada&order=criado_em.desc&limit=60`);

/** Contagem e soma das notas aprovadas por produto, para as estrelas dos cartões. */
export async function summaryApproved(): Promise<Record<string, [number, number]>> {
  const rows = await rest<{ slug: string; nota: number }[]>("avaliacoes?select=slug,nota&status=eq.aprovada&limit=10000");
  const out: Record<string, [number, number]> = {};
  for (const r of rows) {
    const cur = out[r.slug] ?? [0, 0];
    out[r.slug] = [cur[0] + 1, cur[1] + r.nota];
  }
  return out;
}
