import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewCard, reviews } from "@/components/reviews";
import { Benefits, Grid, Shell } from "@/components/site";
import { BEST_SELLERS, MAX_DISCOUNT, SITE_URL, brl, discountPct, forAudience, getProduct, products, useAudience } from "@/lib/store";

/**
 * Banner da home: a arte (título, produtos e fundo) é a imagem enviada pela loja;
 * a oferta (desconto, preço antigo e preço novo) vem do catálogo e fica por cima, em HTML.
 */
function Banner({ slug, priority }: { slug: string; priority: boolean }) {
  const p = getProduct(slug)!;
  const v = p.variants[0]!;
  const off = discountPct(p.compareBase, v.price);
  const saving = p.compareBase ? p.compareBase - v.price : 0;
  return (
    <Link to="/produto/$slug" params={{ slug }} className="group relative block overflow-hidden bg-[oklch(0.98_0.012_88)] text-foreground">
      <img
        src={`/images/banners/${slug}-home.webp`}
        alt={`Vonix Hair ${p.name}`}
        width={1942}
        height={809}
        fetchPriority={priority ? "high" : "auto"}
        className="block h-auto w-full"
      />
      <div className="px-4 pb-12 pt-3 text-center md:absolute md:bottom-[3.5%] md:left-[5.2%] md:p-0 md:text-left">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:justify-start">
          {off > 0 && <span className="rounded bg-foreground px-3 py-1 text-small font-semibold tracking-[0.15em] text-background">{off}% OFF</span>}
          {p.compareBase && <span className="text-body line-through opacity-60">{brl(p.compareBase)}</span>}
          <span className="font-display font-semibold leading-none" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2.4rem)" }}>Por {brl(v.price)}</span>
        </div>
        {saving > 0 && <div className="mt-1 text-small font-semibold">Você economiza {brl(saving)}</div>}
      </div>
    </Link>
  );
}
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vonix Hair — Cosméticos Capilares Profissionais" },
      { name: "description", content: "Progressivas, botox, máscaras e combos Vonix Hair. Até 6x sem juros e frete grátis acima de R$ 150,00." },
      { property: "og:title", content: "Vonix Hair — Cosméticos Capilares Profissionais" },
      { property: "og:description", content: "Até 6x sem juros e frete grátis acima de R$ 150,00." },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-vonix.jpg` },
      { name: "twitter:image", content: `${SITE_URL}/og-vonix.jpg` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Home,
});

const BANNERS = [
  "kit-banana-e-mel", "kit-cachos", "kit-coco-nutri", "kit-cronograma-capilar",
  "kit-desmaia", "kit-whey-protein", "kit-matizador-shampoo-e-mascara",
] as const;
const NEEDS = [
  ["Hidratação", "Mais maciez e brilho", "hidratacao", "Hidratação"],
  ["Reconstrução", "Fios mais fortes", "reconstrucao", "Reconstrução"],
  ["Controle de Frizz", "Cabelos mais alinhados", "frizz", "Controle de Frizz"],
  ["Cachos", "Definição e movimento", "cachos", "Definição de Cachos"],
  ["Com Química", "Cuidado e hidratação", "quimica", "Cabelos com Química"],
  ["Nutrição", "Fios nutridos e macios", "nutricao", "Nutrição"],
] as const;

function Title({ a, b, to }: { a: string; b: string; to?: Record<string, string> }) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <h2 className="[&_em]:not-italic">
        {a} <em>{b}</em>
      </h2>
      {to && (
        <Link to="/loja" search={to} className="flex items-center gap-1 border-b border-foreground py-2 text-small uppercase">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const [i, setI] = useState(0);
  const { audience } = useAudience();
  const bestSellers = forAudience(BEST_SELLERS.map((s) => getProduct(s)!), audience);
  const combos = forAudience(products.filter((p) => p.category === "kits"), audience);
  // "Todos os Produtos" não repete o que já apareceu nas duas vitrines de cima.
  const shown = new Set([...bestSellers, ...combos].map((p) => p.slug));
  const others = forAudience(products, audience).filter((p) => !shown.has(p.slug)).slice(0, 8);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % BANNERS.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <Shell>
      <h1 className="sr-only">Vonix Hair — Cosméticos Capilares Profissionais</h1>
      <section className="container-site pt-5">
        <div className="relative overflow-hidden rounded-2xl">
          <Banner slug={BANNERS[i]!} priority={i === 0} />
          <button aria-label="Anterior" onClick={() => setI((i + 6) % 7)} className="absolute left-3 top-[16%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background focus-visible:outline-2 focus-visible:outline-offset-2 md:left-4 md:top-1/2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Próximo" onClick={() => setI((i + 1) % 7)} className="absolute right-3 top-[16%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background focus-visible:outline-2 focus-visible:outline-offset-2 md:right-4 md:top-1/2">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0 md:bottom-2">
            {BANNERS.map((_, k) => (
              <button key={k} aria-label={`Banner ${k + 1}`} aria-pressed={k === i} onClick={() => setI(k)} className="grid h-10 w-10 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1">
                <span aria-hidden="true" className={`h-3 w-3 rounded-full border border-foreground ${k === i ? "bg-foreground" : "bg-background/70"}`} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <Benefits />

      <section className="container-site mt-12">
        <Title a="Mais" b="Desejados" to={{ secao: "mais-vendidos" }} />
        <Grid carousel items={bestSellers} />
      </section>

      <section className="container-site mt-16">
        <Title a="Todos os" b="Combos" to={{ tiposProduto: "Combos" }} />
        <Grid carousel items={combos} />
      </section>

      <section className="container-site mt-20 text-center">
        <h2 className="[&_em]:not-italic">Encontre o Tratamento <em>Ideal</em></h2>
        <p className="mt-2 text-muted-foreground">Escolha a necessidade do seu cabelo e veja os produtos indicados.</p>
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-6">
          {NEEDS.map(([t, s, img, q]) => (
            <Link key={t} to="/loja" search={{ uso: "pessoal", necessidades: q }} className="group">
              <img src={`/images/categorias/${img}.jpg`} alt={t} width={130} height={130} loading="lazy" className="mx-auto aspect-square w-full max-w-[84px] rounded-full object-cover transition-transform group-hover:scale-105 md:max-w-[120px]" />
              <div className="mt-2 text-body font-medium">{t}</div>
              <div className="text-small leading-tight text-muted-foreground">{s}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-site mt-20">
        <Title a="Todos os" b="Produtos" to={{}} />
        <Grid carousel items={others} />
      </section>

      <section className="container-site mt-20">
        <Title a="Resultados que" b="Falam por Si" to={{ q: "botox vonix" }} />
        <p className="-mt-4 mb-6 text-body text-muted-foreground">Depoimentos reais de cabeleireiras que usam o Botox Vonix.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reviews.map((r) => <ReviewCard key={r.author + r.date} r={r} />)}
        </div>
      </section>

      <section className="container-site mt-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div aria-hidden className="h-72 w-full" style={{ background: "radial-gradient(90% 120% at 15% 10%, oklch(0.66 0.13 82) 0%, oklch(0.4 0.08 70) 45%, oklch(0.2 0.02 60) 100%)" }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/40 text-center text-background">
            <span className="text-body tracking-[0.3em]">ATÉ {MAX_DISCOUNT}% OFF</span>
            <h3 className="font-display text-h1">Ofertas Vonix Hair</h3>
            <p className="mt-2 text-body">Aproveite os preços especiais nos seus favoritos da Vonix Hair.</p>
            <Link to="/loja" className="mt-5 rounded-full bg-background px-6 py-2.5 text-body text-foreground">Ver ofertas</Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
