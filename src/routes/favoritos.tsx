import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid, Shell } from "@/components/site";
import { Heart } from "lucide-react";
import { products, useFavorites } from "@/lib/store";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Favoritos — Vonix Hair" },
      { name: "description", content: "Seus produtos favoritos Vonix Hair." },
      { property: "og:title", content: "Favoritos — Vonix Hair" },
      { property: "og:description", content: "Seus produtos favoritos Vonix Hair." },
    ],
  }),
  component: Favs,
});

function Favs() {
  const { favs } = useFavorites();
  const list = products.filter((p) => favs.includes(p.slug));
  return (
    <Shell>
      <div className="container-site py-10">
        <h1 className="mb-8 font-display text-h1">Favoritos</h1>
        {list.length ? (
          <>
            <p role="status" aria-live="polite" className="mb-6 text-body text-muted-foreground">
              {list.length} {list.length === 1 ? "produto salvo" : "produtos salvos"} neste
              navegador
            </p>
            <Grid items={list} />
          </>
        ) : (
          <section
            aria-label="Sua lista de favoritos"
            className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:py-16"
          >
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Heart className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="font-display text-h2">Sua lista de favoritos está vazia</h2>
            <p className="mt-3 max-w-md text-body text-muted-foreground">
              Toque no coração dos produtos que você gostou para encontrá-los aqui quando voltar
              neste navegador.
            </p>
            <Link
              to="/loja"
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-7 py-3 text-body font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Explorar produtos
            </Link>
          </section>
        )}
      </div>
    </Shell>
  );
}
