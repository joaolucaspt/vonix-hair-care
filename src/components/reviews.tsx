import { useEffect, useRef, useState } from "react";
import raw from "@/data/reviews.json";
import { ReviewForm } from "@/components/review-form";
import { listReviews } from "@/lib/reviews.functions";
import { ShareButton } from "@/components/share-button";
import { SITE_URL, getProduct } from "@/lib/store";

export type Review = {
  slug: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  /** "cliente" (padrão): cliente que comprou. "visitante": avaliação enviada pelo site, aprovada, sem compra confirmada. */
  origem?: "cliente" | "visitante";
  media?: { type: "video" | "image"; src: string; poster?: string };
};

/**
 * Avaliações aprovadas. Clientes reais (com foto ou vídeo) e visitantes (origem "visitante", aparece o selo).
 * As avaliações enviadas pelo site chegam ao dono pelo webhook; as aprovadas entram aqui.
 */
export const reviews = raw as Review[];
export const reviewsFor = (slug: string) => reviews.filter((r) => r.slug === slug);

const month = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");

/** Fica verdadeiro quando o elemento chega a `rootMargin` da tela; sem IntersectionObserver, já no primeiro efeito. */
function useNearScreen(rootMargin = "400px") {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (typeof IntersectionObserver === "undefined" || !el) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, rootMargin]);
  return { ref, near };
}

export function ReviewCard({ r }: { r: Review }) {
  const name = getProduct(r.slug)?.name ?? "um produto da Vonix Hair";
  const { ref, near } = useNearScreen();
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {r.media?.type === "video" &&
        (near ? (
          <video controls playsInline preload="none" poster={r.media.poster} className="aspect-[3/4] w-full bg-black object-cover">
            <source src={r.media.src} type="video/mp4" />
          </video>
        ) : (
          // Caixa preta com a mesma proporção até o cartão chegar perto da tela.
          <div ref={ref} aria-hidden="true" className="aspect-[3/4] w-full bg-black" />
        ))}
      {r.media?.type === "image" && (
        <img src={r.media.src} alt={`Resultado enviado por ${r.author}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
      )}
      <figcaption className="flex flex-1 flex-col p-4">
        <div className="text-star" aria-label={`${r.rating} de 5 estrelas`}>{"★".repeat(r.rating)}</div>
        <blockquote className="mt-1 text-body">{r.comment}</blockquote>
        <div className="mt-2 text-small text-muted-foreground">
          <b className="text-foreground">{r.author}</b> · {month(r.date)}
          {r.origem === "visitante" && <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium">Visitante</span>}
        </div>
        <div className="mt-auto pt-3">
          <ShareButton
            compact
            url={`${SITE_URL}/produto/${r.slug}#avaliacoes`}
            title={`Avaliação de ${r.author} — ${name}`}
            text={`"${r.comment}" — ${r.author}, sobre ${name} (Vonix Hair).`}
          />
        </div>
      </figcaption>
    </figure>
  );
}

/** Seção de avaliações da página do produto: as aprovadas, o compartilhar e o formulário para qualquer visitante avaliar. */
export function ProductReviews({ slug }: { slug: string }) {
  const product = getProduct(slug);
  // Avaliações de visitantes já aprovadas (vêm do banco; vazio se o banco ainda não estiver ligado).
  const [extra, setExtra] = useState<Review[]>([]);
  useEffect(() => {
    let vivo = true;
    setExtra([]);
    listReviews({ data: { slug } })
      .then((r) => vivo && setExtra(r.reviews.map((x) => ({ slug, author: x.author, rating: x.rating, comment: x.comment, date: x.date, origem: "visitante" as const }))))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [slug]);
  const list = [...reviewsFor(slug), ...extra];
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return (
    <section id="avaliacoes" className="mt-16 scroll-mt-32" aria-label="Avaliações">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-h2">Avaliações e <em>comentários</em></h2>
          <p className="mt-1 text-body text-muted-foreground">
            {list.length ? (
              <>
                <span className="text-star">★</span> {avg.toFixed(1).replace(".", ",")} · {list.length} {list.length === 1 ? "avaliação" : "avaliações"}
              </>
            ) : (
              "Ainda sem avaliações. Seja a primeira pessoa a avaliar este produto."
            )}
          </p>
        </div>
        {product && (
          <ShareButton url={`${SITE_URL}/produto/${slug}`} title={`${product.name} — Vonix Hair`} text={`Olha esse produto da Vonix Hair: ${product.name}.`} label="Compartilhar este produto" />
        )}
      </div>
      {list.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {list.map((r, i) => <ReviewCard key={`${r.author}|${r.date}|${i}`} r={r} />)}
        </div>
      )}
      {product && (
        <ReviewForm
          slug={slug}
          productName={product.name}
          onPublished={(x) => setExtra((e) => [{ slug, author: x.author, rating: x.rating, comment: x.comment, date: x.date, origem: "visitante" as const }, ...e])}
        />
      )}
    </section>
  );
}
