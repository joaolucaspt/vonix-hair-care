import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, House, Pause, Play, Scissors } from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewCard, reviews } from "@/components/reviews";
import { AffiliateHomeInvite } from "@/components/affiliate-home-invite";
import { Benefits, Grid, Shell } from "@/components/site";
import { SALES_SNAPSHOT_DATE } from "@/lib/sales";
import {
  BEST_SELLERS,
  MAX_DISCOUNT,
  SITE_URL,
  brl,
  discountPct,
  forAudience,
  getProduct,
  products,
  useAudience,
} from "@/lib/store";

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
    <Link
      to="/produto/$slug"
      params={{ slug }}
      className="group relative block overflow-hidden bg-[oklch(0.98_0.012_88)] text-foreground"
    >
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
          {off > 0 && (
            <span className="rounded bg-foreground px-3 py-1 text-small font-semibold tracking-[0.15em] text-background">
              {off}% OFF
            </span>
          )}
          {p.compareBase && (
            <span className="text-body line-through opacity-60">{brl(p.compareBase)}</span>
          )}
          <span
            className="font-display font-semibold leading-none"
            style={{ fontSize: "clamp(1.5rem, 2.4vw, 2.4rem)" }}
          >
            Por {brl(v.price)}
          </span>
        </div>
        <span className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 py-2 text-body font-semibold text-background transition group-hover:opacity-85">
          Conhecer este kit <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
        {saving > 0 && (
          <div className="mt-1 text-small font-semibold">Você economiza {brl(saving)}</div>
        )}
      </div>
    </Link>
  );
}
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vonix Hair — Cosméticos Capilares Profissionais" },
      {
        name: "description",
        content:
          "Cosméticos Vonix Hair: progressivas, botox, máscaras e kits. Até 6x sem juros; frete grátis acima de R$ 150 conforme cotação do CEP.",
      },
      { property: "og:title", content: "Vonix Hair — Cosméticos Capilares Profissionais" },
      {
        property: "og:description",
        content: "Até 6x sem juros e frete grátis acima de R$ 150, conforme a cotação do CEP.",
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/og-vonix.jpg` },
      { name: "twitter:image", content: `${SITE_URL}/og-vonix.jpg` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Home,
});

const BANNERS = [
  "kit-banana-e-mel",
  "kit-cachos",
  "kit-coco-nutri",
  "kit-cronograma-capilar",
  "kit-desmaia",
  "kit-whey-protein",
  "kit-matizador-shampoo-e-mascara",
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
        <Link
          to="/loja"
          search={to}
          className="flex items-center gap-1 border-b border-foreground py-2 text-small uppercase"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const { audience } = useAudience();
  // Sales order stays authentic regardless of the visitor's Casa/Salão preference.
  const bestSellers = BEST_SELLERS.map((s) => getProduct(s)!);
  const kits = forAudience(
    products.filter((p) => p.category === "kits"),
    audience,
  );
  // "Todos os Produtos" não repete o que já apareceu nas duas vitrines de cima.
  const shown = new Set([...bestSellers, ...kits].map((p) => p.slug));
  const others = forAudience(products, audience)
    .filter((p) => !shown.has(p.slug))
    .slice(0, 8);
  useEffect(() => {
    if (
      paused ||
      (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    )
      return;
    const t = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden)
        setI((x) => (x + 1) % BANNERS.length);
    }, 6000);
    return () => clearInterval(t);
  }, [paused]);
  return (
    <Shell>
      <h1 className="sr-only">Vonix Hair — Cosméticos Capilares Profissionais</h1>
      <section
        className="container-site pt-5"
        aria-label="Destaques da loja"
        onMouseEnter={() => setPaused(true)}
        onFocusCapture={() => setPaused(true)}
      >
        <div className="relative overflow-hidden rounded-2xl">
          <Banner slug={BANNERS[i]!} priority={i === 0} />
          <button
            aria-label="Destaque anterior"
            onClick={() => {
              setPaused(true);
              setI((i + BANNERS.length - 1) % BANNERS.length);
            }}
            className="absolute left-3 top-[16%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background focus-visible:outline-2 focus-visible:outline-offset-2 md:left-4 md:top-1/2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Próximo destaque"
            onClick={() => {
              setPaused(true);
              setI((i + 1) % BANNERS.length);
            }}
            className="absolute right-3 top-[16%] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background focus-visible:outline-2 focus-visible:outline-offset-2 md:right-4 md:top-1/2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Reproduzir destaques" : "Pausar destaques"}
            className="absolute bottom-2 right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-background text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 md:bottom-3 md:right-3"
          >
            {paused ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0 md:bottom-2">
            {BANNERS.map((_, k) => (
              <button
                key={k}
                aria-label={`Mostrar destaque ${k + 1}: ${getProduct(BANNERS[k]!)!.name}`}
                aria-pressed={k === i}
                onClick={() => {
                  setPaused(true);
                  setI(k);
                }}
                className="grid h-10 w-10 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 rounded-full border border-foreground ${k === i ? "bg-foreground" : "bg-background/70"}`}
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      <Benefits />

      <section className="container-site mt-12" aria-labelledby="jornada-vonix">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-small font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Sua jornada de cuidado
            </span>
            <h2 id="jornada-vonix" className="mt-1 font-display text-h2">
              Explore do seu jeito
            </h2>
          </div>
          <p className="max-w-lg text-body text-muted-foreground">
            Escolha como você usa os produtos e descubra as linhas do catálogo. Frete e
            disponibilidade são conferidos antes da compra.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            to="/loja"
            search={{ uso: "casa" }}
            className="group flex min-h-40 items-center justify-between gap-5 rounded-2xl border border-border bg-[#f8f4ec] p-6 shadow-sm transition hover:border-[#b59b65] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div>
              <span className="text-small font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Cuidado em casa
              </span>
              <h3 className="mt-2 font-display text-h2">Para minha rotina</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Explore máscaras, shampoos, finalizadores e kits.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-body font-semibold underline underline-offset-4">
                Ver produtos{" "}
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </div>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/75 text-[#71562f]">
              <House className="h-8 w-8" strokeWidth={1.4} aria-hidden="true" />
            </span>
          </Link>
          <Link
            to="/loja"
            search={{ uso: "salao" }}
            className="group flex min-h-40 items-center justify-between gap-5 rounded-2xl border border-border bg-[#edf3ee] p-6 shadow-sm transition hover:border-[#62846c] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div>
              <span className="text-small font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Cuidado profissional
              </span>
              <h3 className="mt-2 font-display text-h2">Para o salão</h3>
              <p className="mt-2 text-body text-muted-foreground">
                Encontre os tratamentos e linhas para uso profissional.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-body font-semibold underline underline-offset-4">
                Ver produtos{" "}
                <ArrowRight
                  className="h-4 w-4 transition group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </div>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/75 text-[#376046]">
              <Scissors className="h-8 w-8" strokeWidth={1.4} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      <section className="container-site mt-12">
        <Title a="Mais" b="Vendidos" to={{ secao: "mais-vendidos" }} />
        <p className="-mt-5 mb-5 text-small text-muted-foreground">
          Ranking histórico de unidades informadas pela loja até {SALES_SNAPSHOT_DATE}. Não indica
          estoque atual.
        </p>
        <Grid carousel items={bestSellers} />
      </section>

      <section className="container-site mt-16">
        <Title a="Todos os" b="Kits" to={{ tiposProduto: "Kits" }} />
        <Grid carousel items={kits} />
      </section>

      <section className="container-site mt-20 text-center">
        <h2 className="[&_em]:not-italic">
          Encontre o Tratamento <em>Ideal</em>
        </h2>
        <p className="mt-2 text-muted-foreground">
          Escolha a necessidade do seu cabelo e veja os produtos indicados.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-6">
          {NEEDS.map(([t, s, img, q]) => (
            <Link key={t} to="/loja" search={{ uso: "casa", necessidades: q }} className="group">
              <img
                src={`/images/categorias/${img}.jpg`}
                alt={t}
                width={130}
                height={130}
                loading="lazy"
                className="mx-auto aspect-square w-full max-w-[84px] rounded-full object-cover transition-transform group-hover:scale-105 md:max-w-[120px]"
              />
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

      <AffiliateHomeInvite />

      <section className="container-site mt-20">
        <Title a="Resultados que" b="Falam por Si" to={{ q: "botox vonix" }} />
        <p className="-mt-4 mb-6 text-body text-muted-foreground">
          Experiências compartilhadas com a Vonix Hair sobre o Botox Vonix.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {reviews.map((r) => (
            <ReviewCard key={r.author + r.date} r={r} />
          ))}
        </div>
      </section>

      <section className="container-site mt-20">
        <div className="relative overflow-hidden rounded-2xl">
          <div
            aria-hidden
            className="h-72 w-full"
            style={{
              background:
                "radial-gradient(90% 120% at 15% 10%, oklch(0.66 0.13 82) 0%, oklch(0.4 0.08 70) 45%, oklch(0.2 0.02 60) 100%)",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/40 text-center text-background">
            <span className="text-body tracking-[0.3em]">ATÉ {MAX_DISCOUNT}% OFF</span>
            <h3 className="font-display text-h1">Ofertas Vonix Hair</h3>
            <p className="mt-2 text-body">
              Aproveite os preços especiais nos seus favoritos da Vonix Hair.
            </p>
            <Link
              to="/loja"
              className="mt-5 rounded-full bg-background px-6 py-2.5 text-body text-foreground"
            >
              Ver ofertas
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
