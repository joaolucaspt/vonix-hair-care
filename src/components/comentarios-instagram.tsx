import raw from "@/data/comentarios-instagram.json";

type Comentario = { user: string; text: string; produto: string; slugs: string[]; url: string; afiliada?: boolean };
const comentarios = raw as Comentario[];

/** Comentários reais feitos em posts públicos do Instagram da Vonix e das afiliadas, com o texto exatamente como foi escrito. */
export function ComentariosInstagram({ slug, max = 6 }: { slug?: string; max?: number }) {
  const own = slug ? comentarios.filter((c) => c.slugs.includes(slug)) : [];
  const list = (slug ? [...own, ...comentarios.filter((c) => !c.slugs.includes(slug))] : comentarios).slice(0, max);
  if (list.length === 0) return null;
  return (
    <section aria-label="Comentários reais no Instagram" className="mt-4">
      <p className="mb-2 text-small font-semibold">Comentários reais no Instagram da Vonix e das afiliadas</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((c, i) => (
          <li key={`${c.user}|${i}`} className="rounded-xl border border-border bg-card p-3">
            <blockquote className="text-body">“{c.text}”</blockquote>
            <p className="mt-1 text-small text-muted-foreground">
              <b className="text-foreground">@{c.user}</b>
              {c.afiliada ? " (afiliada Vonix)" : ""} · {c.produto} ·{" "}
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">ver no Instagram</a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
