import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid, Shell } from "@/components/site";
import { products, useFavorites } from "@/lib/store";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
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
        {list.length ? <Grid items={list} /> : (
          <p className="py-16 text-center text-muted-foreground">Você ainda não favoritou produtos. <Link to="/loja" className="underline">Ver loja</Link></p>
        )}
      </div>
    </Shell>
  );
}
