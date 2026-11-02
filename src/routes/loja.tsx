import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Grid, Shell } from "@/components/site";
import { BEST_SELLERS, NEEDS, products, TYPES, forAudience, resolveAudience, useAudience } from "@/lib/store";

type S = { q?: string | undefined; secao?: string | undefined; tiposProduto?: string | undefined; necessidades?: string | undefined; uso?: string | undefined; categoria?: string | undefined; ordem?: string | undefined };

export const Route = createFileRoute("/loja")({
  validateSearch: (s: Record<string, unknown>): S => {
    const o: S = {};
    for (const k of ["q", "secao", "tiposProduto", "necessidades", "uso", "categoria", "ordem"] as const)
      if (typeof s[k] === "string" && s[k]) o[k] = s[k] as string;
    return o;
  },
  head: () => ({
    meta: [
      { title: "Loja — Vonix Hair" },
      { name: "description", content: "Todos os produtos Vonix Hair: progressivas, botox, máscaras, shampoos e combos." },
      { property: "og:title", content: "Loja — Vonix Hair" },
      { property: "og:description", content: "Todos os produtos Vonix Hair em até 6x sem juros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Loja,
});

const CATS = Array.from(new Map(products.map((p) => [p.category, p.categoryLabel])));

function Loja() {
  const s = Route.useSearch();
  const { audience } = useAudience();
  const uso = resolveAudience(audience, s.uso);
  const nav = useNavigate({ from: "/loja" });
  const set = (patch: Partial<S>) => nav({ search: (old: S) => ({ ...old, ...patch }) });
  let list = products.filter((p) => {
    if (s.secao === "mais-vendidos" && !BEST_SELLERS.includes(p.slug)) return false;
    if (s.categoria && p.category !== s.categoria) return false;
    if (s.tiposProduto && TYPES[s.tiposProduto] && !TYPES[s.tiposProduto]!(p)) return false;
    if (s.necessidades && NEEDS[s.necessidades] && !NEEDS[s.necessidades]!.test(p.name + " " + p.description)) return false;
    if (s.q) {
      const q = s.q.toLowerCase();
      if (!(p.name + " " + p.categoryLabel + " " + p.short).toLowerCase().includes(q)) return false;
    }
    return true;
  });
  if (s.ordem === "menor") list = [...list].sort((a, b) => a.variants[0].price - b.variants[0].price);
  if (s.ordem === "maior") list = [...list].sort((a, b) => b.variants[0].price - a.variants[0].price);
  if (s.ordem === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (!["menor", "maior", "az"].includes(s.ordem ?? "")) list = forAudience(list, uso);
  const browsing = !s.q && !s.categoria && !s.tiposProduto && !s.necessidades && !s.secao && !s.ordem;
  const rows = Array.from(
    list.reduce((m, p) => m.set(p.categoryLabel, [...(m.get(p.categoryLabel) ?? []), p]), new Map<string, typeof list>()),
  );
  const sel = "h-10 rounded-full border border-border bg-background px-4 text-body";
  return (
    <Shell>
      <div className="container-site py-10">
        <h1 className="font-display text-h1">{s.q ? `Busca: “${s.q}”` : s.secao ? "Mais Vendidos" : uso === "casa" ? "Para Mim — Cuidados em Casa" : uso === "salao" ? "Para Cabeleireiras — Produtos para Salão" : s.tiposProduto ?? s.necessidades ?? "Todos os Produtos"}</h1>
        <div className="my-6 flex flex-wrap items-center gap-3">
          <input defaultValue={s.q} key={s.q} placeholder="Buscar..." aria-label="Buscar na loja" className={sel} onKeyDown={(e) => e.key === "Enter" && set({ q: e.currentTarget.value || undefined })} />
          <select aria-label="Categoria" className={sel} value={s.categoria ?? ""} onChange={(e) => set({ categoria: e.target.value || undefined })}>
            <option value="">Todas as categorias</option>
            {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select aria-label="Tipo" className={sel} value={s.tiposProduto ?? ""} onChange={(e) => set({ tiposProduto: e.target.value || undefined })}>
            <option value="">Todos os tipos</option>
            {Object.keys(TYPES).map((k) => <option key={k}>{k}</option>)}
          </select>
          <select aria-label="Necessidade" className={sel} value={s.necessidades ?? ""} onChange={(e) => set({ necessidades: e.target.value || undefined })}>
            <option value="">Todas as necessidades</option>
            {Object.keys(NEEDS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <select aria-label="Ordenar" className={sel} value={s.ordem ?? ""} onChange={(e) => set({ ordem: e.target.value || undefined })}>
            <option value="">Relevância</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="az">A–Z</option>
          </select>
          <Link to="/loja" className="text-body underline">Limpar filtros</Link>
          <span className="ml-auto text-body text-muted-foreground">{list.length} produtos</span>
        </div>
        {!list.length ? (
          <p className="py-20 text-center text-muted-foreground">Nenhum produto encontrado.</p>
        ) : browsing ? (
          // Same system in both areas: one swipeable row per category; scroll down to move between categories.
          <div className="space-y-10">
            {rows.map(([label, items]) => (
              <section key={label} aria-label={label}>
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-h2">{label}</h2>
                  <span className="text-body text-muted-foreground">{items.length} {items.length === 1 ? "produto" : "produtos"}</span>
                </div>
                <Grid carousel items={items} />
              </section>
            ))}
          </div>
        ) : (
          <Grid items={list} />
        )}
      </div>
    </Shell>
  );
}
