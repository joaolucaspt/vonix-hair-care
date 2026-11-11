import raw from "@/data/comentarios-instagram.json";

type Comentario = { user: string; text: string; produto: string; slugs: string[]; url: string; afiliada?: boolean; fonte?: string };
const comentarios = raw as Comentario[];

/** Embaralha de forma estável: o mesmo lugar sempre mostra a mesma ordem, mas lugares diferentes misturam diferente. */
const shuffle = <T,>(list: T[], seed: string) => {
  let h = [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17);
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
};

/** Comentários reais feitos em posts públicos do Instagram da Vonix e das afiliadas, com o texto exatamente como foi escrito. */
export function ComentariosInstagram({ slug, max = 6 }: { slug?: string; max?: number }) {
  const own = slug ? comentarios.filter((c) => c.slugs.includes(slug)) : [];
  // Página de produto: os do próprio produto primeiro; os demais completam e cada um diz de qual produto fala. Sempre misturados.
  const rest = comentarios.filter((c) => !own.includes(c));
  const pool = slug ? [...shuffle(own, slug), ...shuffle(rest, slug + "-r")] : comentarios;
  const list = shuffle(pool.slice(0, max), (slug ?? "home") + "-f");
  if (list.length === 0) return null;
  return (
    <section aria-label="Comentários reais no Instagram" className="mt-4">
      <p className="mb-2 text-small font-semibold">Comentários reais nas redes da Vonix</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((c, i) => (
          <li key={`${c.user}|${i}`} className="rounded-xl border border-border bg-card p-3">
            <blockquote className="text-body">“{c.text}”</blockquote>
            <p className="mt-1 text-small text-muted-foreground">
              <b className="text-foreground">{c.fonte ? c.user : `@${c.user}`}</b>
              {c.fonte ? ` no ${c.fonte}` : ""} · {c.produto}{c.url ? (
                <>
                  {" "}·{" "}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">ver no Instagram</a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
