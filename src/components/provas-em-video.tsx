import { useState } from "react";
import raw from "@/data/provas-em-video.json";

type Prova = { id: string; src: string; poster: string; slugs: string[] };
const provas = raw as Prova[];

/** Vídeos do produto primeiro; para completar, os vídeos gerais de afiliadas e embaixadoras da Vonix. */
export const provasFor = (slug: string, max = 6) => {
  const own = provas.filter((p) => p.slugs.includes(slug));
  const general = provas.filter((p) => !p.slugs.includes(slug));
  return [...own, ...general].slice(0, max).map((p) => ({ ...p, own: p.slugs.includes(slug) }));
};

/**
 * Faixa de vídeos reais de afiliadas e embaixadoras Vonix usando os produtos. O vídeo só toca (e só baixa) quando a pessoa toca nele.
 * Sem `slug`, mostra todos (home). O rótulo é honesto: vídeo do próprio produto diz "usando este produto"; os demais, "linha Vonix".
 */
export function ProvasEmVideo({ slug, all = false, className = "" }: { slug?: string; all?: boolean; className?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const list = all || !slug ? provas.map((p) => ({ ...p, own: false })) : provasFor(slug);
  if (list.length === 0) return null;
  return (
    <section aria-label="Vídeos de afiliadas e embaixadoras Vonix" className={className}>
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
        {list.map((p) => (
          <li key={p.id} className="w-[8rem] shrink-0 snap-start sm:w-36">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
              {playing === p.id ? (
                <video controls autoPlay playsInline poster={p.poster} className="h-full w-full object-cover">
                  <source src={p.src} type="video/mp4" />
                </video>
              ) : (
                <button type="button" onClick={() => setPlaying(p.id)} className="block h-full w-full" aria-label="Assistir ao vídeo">
                  <img src={p.poster} alt="" width={360} height={640} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">▶</span>
                  </span>
                </button>
              )}
            </div>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">{p.own ? "Afiliada usando este produto" : "Afiliada da linha Vonix"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
