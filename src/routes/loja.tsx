import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SALES_SNAPSHOT_DATE } from "@/lib/sales";
import { Grid, Shell } from "@/components/site";
import {
  BEST_SELLERS,
  NEEDS,
  SITE_URL,
  products,
  type Product,
  TYPES,
  forAudience,
  resolveAudience,
  useAudience,
} from "@/lib/store";

type S = {
  q?: string | undefined;
  secao?: string | undefined;
  tiposProduto?: string | undefined;
  necessidades?: string | undefined;
  uso?: string | undefined;
  categoria?: string | undefined;
  ordem?: string | undefined;
};

/** Normalize public URL filters without reflecting arbitrarily long queries. */
export function normalizeStoreSearch(s: Record<string, unknown>): S {
  const normalized: S = {};
  for (const key of [
    "q",
    "secao",
    "tiposProduto",
    "necessidades",
    "uso",
    "categoria",
    "ordem",
  ] as const) {
    const value = s[key];
    if (typeof value !== "string") continue;
    const safeValue = value.trim().slice(0, key === "q" ? 120 : 80);
    if (safeValue) normalized[key] = safeValue;
  }
  // Keep bookmarks /loja?tiposProduto=Combos usable after the public rebrand.
  if (normalized.tiposProduto === "Combos") normalized.tiposProduto = "Kits";
  // Avoid URLs that silently claim an invalid filter or ordering was applied.
  if (normalized.secao && normalized.secao !== "mais-vendidos") delete normalized.secao;
  if (normalized.categoria && !products.some((p) => p.category === normalized.categoria))
    delete normalized.categoria;
  if (normalized.tiposProduto && !TYPES[normalized.tiposProduto]) delete normalized.tiposProduto;
  if (normalized.necessidades && !NEEDS[normalized.necessidades]) delete normalized.necessidades;
  if (normalized.uso && !["casa", "salao"].includes(normalized.uso)) delete normalized.uso;
  if (normalized.ordem && !["menor", "maior", "az"].includes(normalized.ordem))
    delete normalized.ordem;
  return normalized;
}
/** Match Brazilian Portuguese queries with or without accent marks, case or extra spaces. */
const searchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

export function matchesStoreQuery(
  product: Pick<Product, "name" | "categoryLabel" | "short"> & Partial<Pick<Product, "variants">>,
  query: string,
): boolean {
  // Old "combo" terminology may occur ANYWHERE in the search, not just as the first word.
  const words = searchKey(query)
    .split(" ")
    .filter(Boolean)
    .map((word) => (word === "combo" ? "kit" : word === "combos" ? "kits" : word));
  if (!words.length) return true;
  // Size is a real selection attribute and should be searchable, not silently excluded.
  const variants = product.variants?.map((variant) => variant.label).join(" ") ?? "";
  const haystack = searchKey(
    `${product.name} ${product.categoryLabel} ${product.short} ${variants}`,
  );
  // All terms may occur in different fields, not necessarily beside one another.
  return words.every((word) => haystack.includes(word));
}

export const Route = createFileRoute("/loja")({
  validateSearch: normalizeStoreSearch,
  head: () => ({
    meta: [
      { title: "Loja — Vonix Hair" },
      {
        name: "description",
        content: "Todos os produtos Vonix Hair: progressivas, botox, máscaras, shampoos e kits.",
      },
      { property: "og:title", content: "Loja — Vonix Hair" },
      { property: "og:description", content: "Todos os produtos Vonix Hair em até 6x sem juros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: `${SITE_URL}/loja` },
      { property: "og:image", content: `${SITE_URL}/og-vonix.jpg` },
      { name: "twitter:image", content: `${SITE_URL}/og-vonix.jpg` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/loja` }],
  }),
  component: Loja,
});

const CATS = Array.from(new Map(products.map((p) => [p.category, p.categoryLabel])));

export function Loja() {
  // Normalize at the UI boundary as well: a legacy or client-side route may
  // still expose its raw query object before validation has propagated.
  const s = normalizeStoreSearch(Route.useSearch() as Record<string, unknown>);
  const { audience, set: setAudience } = useAudience();
  const uso = resolveAudience(audience, s.uso);
  // An explicit audience link is a new choice, even if this tab saved another area.
  // Keep the header and subsequent navigation consistent after hydration.
  useEffect(() => {
    if (s.uso && s.uso !== audience) setAudience(uso);
  }, [s.uso, audience, uso, setAudience]);
  const nav = useNavigate({ from: "/loja" });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<S>) => nav({ search: (old: S) => ({ ...old, ...patch }) });
  let list = products.filter((p) => {
    if (s.secao === "mais-vendidos" && !BEST_SELLERS.includes(p.slug)) return false;
    if (s.categoria && p.category !== s.categoria) return false;
    if (s.tiposProduto && TYPES[s.tiposProduto] && !TYPES[s.tiposProduto]!(p)) return false;
    if (
      s.necessidades &&
      NEEDS[s.necessidades] &&
      !NEEDS[s.necessidades]!.test(p.name + " " + p.description)
    )
      return false;
    if (s.q) {
      const q = s.q;
      if (!matchesStoreQuery(p, q)) return false;
    }
    return true;
  });
  // A Most Sold section must keep its historical sales order, not audience relevance.
  if (s.secao === "mais-vendidos" && !s.ordem)
    list = [...list].sort((a, b) => BEST_SELLERS.indexOf(a.slug) - BEST_SELLERS.indexOf(b.slug));
  if (s.ordem === "menor")
    list = [...list].sort((a, b) => a.variants[0].price - b.variants[0].price);
  if (s.ordem === "maior")
    list = [...list].sort((a, b) => b.variants[0].price - a.variants[0].price);
  if (s.ordem === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (!s.secao && !["menor", "maior", "az"].includes(s.ordem ?? "")) list = forAudience(list, uso);
  const browsing =
    !s.q && !s.categoria && !s.tiposProduto && !s.necessidades && !s.secao && !s.ordem;
  const rows = Array.from(
    list.reduce(
      (m, p) => m.set(p.categoryLabel, [...(m.get(p.categoryLabel) ?? []), p]),
      new Map<string, typeof list>(),
    ),
  );
  const sel = "h-11 rounded-full border border-border bg-background px-4 text-body";
  const categoryName = s.categoria ? CATS.find(([key]) => key === s.categoria)?.[1] : undefined;
  const activeFilters: { key: keyof S; label: string }[] = [
    ...(s.q ? [{ key: "q" as const, label: `Busca: ${s.q}` }] : []),
    ...(s.categoria && categoryName
      ? [{ key: "categoria" as const, label: `Categoria: ${categoryName}` }]
      : []),
    ...(s.tiposProduto ? [{ key: "tiposProduto" as const, label: `Tipo: ${s.tiposProduto}` }] : []),
    ...(s.necessidades
      ? [{ key: "necessidades" as const, label: `Necessidade: ${s.necessidades}` }]
      : []),
    ...(s.secao ? [{ key: "secao" as const, label: "Seção: Mais vendidos" }] : []),
    ...(s.uso
      ? [{ key: "uso" as const, label: `Público: ${s.uso === "salao" ? "Salão" : "Casa"}` }]
      : []),
    ...(s.ordem
      ? [
          {
            key: "ordem" as const,
            label: `Ordem: ${s.ordem === "menor" ? "Menor preço" : s.ordem === "maior" ? "Maior preço" : "A–Z"}`,
          },
        ]
      : []),
  ];
  return (
    <Shell>
      <div className="container-site py-10">
        <h1 className="font-display text-h1">
          {s.q
            ? `Busca: “${s.q}”`
            : s.secao
              ? "Mais Vendidos"
              : categoryName
                ? categoryName
                : uso === "casa"
                  ? "Para Mim — Cuidados em Casa"
                  : uso === "salao"
                    ? "Para Cabeleireiras — Produtos para Salão"
                    : (s.tiposProduto ?? s.necessidades ?? "Todos os Produtos")}
        </h1>
        {s.secao === "mais-vendidos" && (
          <p className="mt-3 text-small text-muted-foreground">
            Ordenados por unidades registradas pela loja até {SALES_SNAPSHOT_DATE}; não é uma
            medição em tempo real nem confirmação de estoque.
          </p>
        )}
        <div className="my-6 flex flex-wrap items-center gap-3">
          <form
            role="search"
            aria-label="Buscar produtos"
            action="/loja"
            method="get"
            className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: searchInputRef.current?.value.trim().slice(0, 120) || undefined });
            }}
          >
            {(["secao", "tiposProduto", "necessidades", "uso", "categoria", "ordem"] as const).map(
              (key) => s[key] && <input key={key} type="hidden" name={key} value={s[key]} />,
            )}
            <input
              ref={searchInputRef}
              key={s.q ?? ""}
              type="search"
              name="q"
              enterKeyHint="search"
              maxLength={120}
              defaultValue={s.q}
              placeholder="Buscar..."
              aria-label="Buscar na loja"
              className={`${sel} min-w-0 flex-1 sm:w-56`}
            />
            <button
              type="submit"
              className="min-h-11 rounded-full bg-foreground px-5 text-body font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Buscar
            </button>
          </form>
          <select
            aria-label="Categoria"
            className={sel}
            value={s.categoria ?? ""}
            onChange={(e) => set({ categoria: e.target.value || undefined })}
          >
            <option value="">Todas as categorias</option>
            {CATS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo"
            className={sel}
            value={s.tiposProduto ?? ""}
            onChange={(e) => set({ tiposProduto: e.target.value || undefined })}
          >
            <option value="">Todos os tipos</option>
            {Object.keys(TYPES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select
            aria-label="Necessidade"
            className={sel}
            value={s.necessidades ?? ""}
            onChange={(e) => set({ necessidades: e.target.value || undefined })}
          >
            <option value="">Todas as necessidades</option>
            {Object.keys(NEEDS).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <select
            aria-label="Ordenar"
            className={sel}
            value={s.ordem ?? ""}
            onChange={(e) => set({ ordem: e.target.value || undefined })}
          >
            <option value="">Relevância</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="az">A–Z</option>
          </select>
          <Link to="/loja" className="text-body underline">
            Limpar filtros
          </Link>
          <span
            role="status"
            aria-live="polite"
            className="ml-auto text-body text-muted-foreground"
          >
            {list.length} {list.length === 1 ? "produto" : "produtos"}
          </span>
        </div>
        {activeFilters.length > 0 && (
          <div
            role="group"
            aria-label="Filtros ativos"
            className="mb-6 flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-small text-muted-foreground">Filtros ativos:</span>
            {activeFilters.map((filter) => (
              <Link
                key={filter.key}
                to="/loja"
                search={{ ...s, [filter.key]: undefined }}
                aria-label={`Remover filtro ${filter.label}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-small font-semibold text-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {filter.label}
                <span aria-hidden="true" className="text-muted-foreground">
                  ×
                </span>
              </Link>
            ))}
          </div>
        )}
        {!list.length ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-14 text-center">
            <h2 className="font-display text-h2">Nenhum produto encontrado.</h2>
            <p className="mx-auto mt-3 max-w-xl text-body text-muted-foreground">
              {activeFilters.length > 0
                ? "Retire um filtro para ampliar a busca ou explore todos os produtos."
                : "Experimente outros termos ou explore todos os produtos Vonix Hair."}
            </p>
            <Link
              to="/loja"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-6 py-3 text-body font-semibold text-background"
            >
              Ver todos os produtos
            </Link>
          </div>
        ) : browsing ? (
          // Same system in both areas: one swipeable row per category; scroll down to move between categories.
          <div className="space-y-10">
            {rows.map(([label, items]) => (
              <section key={label} aria-label={label}>
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-h2">{label}</h2>
                  <span className="text-body text-muted-foreground">
                    {items.length} {items.length === 1 ? "produto" : "produtos"}
                  </span>
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
