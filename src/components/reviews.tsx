import raw from "@/data/reviews.json";

export type Review = {
  slug: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  media?: { type: "video" | "image"; src: string; poster?: string };
};

/** Only real customer testimonials (with photo or video). Add new ones to src/data/reviews.json. */
export const reviews = raw as Review[];
export const reviewsFor = (slug: string) => reviews.filter((r) => r.slug === slug);

const month = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");

export function ReviewCard({ r }: { r: Review }) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {r.media?.type === "video" && (
        <video controls playsInline preload="none" poster={r.media.poster} className="aspect-[3/4] w-full bg-black object-cover">
          <source src={r.media.src} type="video/mp4" />
        </video>
      )}
      {r.media?.type === "image" && (
        <img src={r.media.src} alt={`Resultado enviado por ${r.author}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
      )}
      <figcaption className="p-4">
        <div className="text-star" aria-label={`${r.rating} de 5 estrelas`}>{"★".repeat(r.rating)}</div>
        <blockquote className="mt-1 text-body">{r.comment}</blockquote>
        <div className="mt-2 text-small text-muted-foreground"><b className="text-foreground">{r.author}</b> · {month(r.date)}</div>
      </figcaption>
    </figure>
  );
}

/** Product page section: only renders when the product has real reviews. */
export function ProductReviews({ slug }: { slug: string }) {
  const list = reviewsFor(slug);
  if (!list.length) return null;
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  return (
    <section className="mt-16" aria-label="Avaliações de clientes">
      <h2 className="font-display text-h2">Avaliações de <em>clientes</em></h2>
      <p className="mt-1 text-body text-muted-foreground">
        <span className="text-star">★</span> {avg.toFixed(1).replace(".", ",")} · {list.length} {list.length === 1 ? "avaliação" : "avaliações"} com foto ou vídeo
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {list.map((r) => <ReviewCard key={r.author + r.date} r={r} />)}
      </div>
    </section>
  );
}
