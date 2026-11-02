import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewCard, reviews } from "@/components/reviews";
import { Benefits, Grid, Shell } from "@/components/site";
import { BEST_SELLERS, MAX_DISCOUNT, brl, discountPct, forAudience, getProduct, products, useAudience } from "@/lib/store";

/** Cores de cada arte: vêm das embalagens do combo. */
const THEME: Record<string, { from: string; to: string; accent: string }> = {
  "kit-banana-e-mel": { from: "oklch(0.98 0.035 92)", to: "oklch(0.84 0.13 78)", accent: "oklch(0.5 0.11 65)" },
  "kit-cachos": { from: "oklch(0.98 0.06 108)", to: "oklch(0.88 0.17 104)", accent: "oklch(0.36 0.06 105)" },
  "kit-coco-nutri": { from: "oklch(0.97 0.06 130)", to: "oklch(0.8 0.16 136)", accent: "oklch(0.34 0.08 140)" },
  "kit-cronograma-capilar": { from: "oklch(0.96 0.03 250)", to: "oklch(0.78 0.1 280)", accent: "oklch(0.34 0.1 275)" },
  "kit-desmaia": { from: "oklch(0.96 0.04 20)", to: "oklch(0.76 0.16 25)", accent: "oklch(0.4 0.16 25)" },
  "kit-whey-protein": { from: "oklch(0.96 0.012 40)", to: "oklch(0.7 0.14 30)", accent: "oklch(0.32 0.1 28)" },
  "kit-matizador-shampoo-e-mascara": { from: "oklch(0.97 0.03 290)", to: "oklch(0.78 0.11 295)", accent: "oklch(0.38 0.13 295)" },
};

const LEAVES = [[0.9, -1, 38], [0.78, 1, 40], [0.64, -1, 44], [0.5, 1, 46], [0.36, -1, 48], [0.22, 1, 50], [0.1, -1, 52]] as const;

/** Galho de folhas desenhado em SVG; a cor vem do tema de cada banner. */
function Branch({ color, className }: { color: string; className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 320" className={`pointer-events-none absolute ${className}`} fill={color}>
      <path d="M100 318 C96 220 108 120 100 12" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
      {LEAVES.map(([k, side, r], n) => {
        const y = 318 - k * 300;
        return <ellipse key={n} cx={100 + side * 26} cy={y} rx="30" ry="11" transform={`rotate(${side * -r} ${100} ${y})`} opacity={0.55 + (n % 3) * 0.15} />;
      })}
      <ellipse cx="100" cy="10" rx="9" ry="22" />
    </svg>
  );
}
function Banner({ slug, priority }: { slug: string; priority: boolean }) {
  const p = getProduct(slug)!;
  const v = p.variants[0]!;
  const off = discountPct(p.compareBase, v.price);
  const t = THEME[slug]!;
  const saving = p.compareBase ? p.compareBase - v.price : 0;
  return (
    <Link
      to="/produto/$slug"
      params={{ slug }}
      onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--ry", `${((e.clientX - b.left) / b.width - 0.5) * 18}deg`); e.currentTarget.style.setProperty("--rx", `${-((e.clientY - b.top) / b.height - 0.5) * 12}deg`); }}
      onMouseLeave={(e) => { e.currentTarget.style.removeProperty("--ry"); e.currentTarget.style.removeProperty("--rx"); }}
      className="relative flex aspect-[2/3] flex-col overflow-hidden text-foreground md:aspect-[1850/700] md:flex-row-reverse md:items-center"
      style={{ background: `linear-gradient(125deg, ${t.from} 0%, ${t.to} 100%)` }}
    >
      <Branch color={t.accent} className="-left-3 top-[-4%] h-[46%] -rotate-[28deg] opacity-30 md:-left-4 md:top-[-12%] md:h-[78%] md:rotate-[22deg]" />
      <Branch color={t.accent} className="-right-4 bottom-[18%] h-[38%] rotate-[24deg] opacity-25 md:bottom-[-6%] md:right-[-1%] md:h-[72%] md:-rotate-[18deg]" />
      <Branch color="white" className="bottom-[24%] left-[2%] h-[30%] rotate-[-18deg] opacity-60 blur-[1px] md:bottom-[-14%] md:left-[40%] md:h-[52%] md:rotate-[12deg]" />
      <div aria-hidden className="pointer-events-none absolute -right-[10%] -top-[30%] aspect-square w-[70%] rounded-full border border-white/50 md:-right-[4%] md:-top-[45%] md:w-[48%]" />
      <div aria-hidden className="pointer-events-none absolute -right-[2%] -top-[18%] aspect-square w-[52%] rounded-full border border-white/40 md:right-[4%] md:-top-[32%] md:w-[36%]" />
      <div aria-hidden className="pointer-events-none absolute -left-[20%] bottom-[-35%] aspect-square w-[60%] rounded-full bg-white/20 blur-2xl md:left-[-6%] md:w-[34%]" />
      <div aria-hidden className="pointer-events-none absolute left-[12%] top-[14%] h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_4px_rgba(255,255,255,0.7)]" />
      <div aria-hidden className="pointer-events-none absolute right-[14%] top-[38%] h-1 w-1 rounded-full bg-white/90 shadow-[0_0_10px_3px_rgba(255,255,255,0.7)]" />
      <div aria-hidden className="pointer-events-none absolute bottom-[30%] left-[46%] hidden h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_12px_4px_rgba(255,255,255,0.7)] md:block" />

      <div className="relative min-h-0 flex-1 self-stretch [perspective:900px] md:w-[52%] md:flex-none">
        <div aria-hidden className="absolute left-1/2 top-1/2 aspect-square h-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55 blur-2xl" />
        <div aria-hidden className="absolute bottom-[7%] left-1/2 banner-shadow h-[6%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/25 blur-xl md:bottom-[10%]" />
        <img src={`/images/banners/${slug}.png`} alt={`Vonix Hair ${p.name}`} width={300} height={300} fetchPriority={priority ? "high" : "auto"} className="banner-3d absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)] md:inset-3" />
      </div>

      <div className="relative px-12 pb-10 text-center md:w-[48%] md:px-12 md:pb-0 md:text-left">
        <div className="font-display leading-[1.05]" style={{ fontSize: "clamp(1.5rem, 3.6vw, 3.4rem)" }}>{p.name}</div>
        <p className="mt-2 hidden max-w-md text-body md:block" style={{ color: t.accent }}>{p.short}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:mt-4 md:justify-start">
          {off > 0 && <span className="rounded bg-foreground px-3 py-1 text-small font-semibold tracking-[0.15em] text-background">{off}% OFF</span>}
          {p.compareBase && <span className="text-body line-through opacity-60">{brl(p.compareBase)}</span>}
        </div>
        <div className="mt-1 font-display font-semibold leading-none" style={{ fontSize: "clamp(1.9rem, 3.2vw, 3rem)" }}>Por {brl(v.price)}</div>
        {saving > 0 && <div className="mt-1 text-small font-semibold" style={{ color: t.accent }}>Você economiza {brl(saving)}</div>}
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-small font-semibold uppercase tracking-[0.15em] text-background shadow-lg">
          Aproveitar oferta <ArrowRight className="h-4 w-4" />
        </span>
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
    ],
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
          <button aria-label="Anterior" onClick={() => setI((i + 6) % 7)} className="absolute left-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Próximo" onClick={() => setI((i + 1) % 7)} className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
            {BANNERS.map((_, k) => (
              <button key={k} aria-label={`Banner ${k + 1}`} onClick={() => setI(k)} className={`relative h-3 w-3 rounded-full border border-foreground before:absolute before:-inset-1.5 before:content-[''] ${k === i ? "bg-foreground" : "bg-background/70"}`} />
            ))}
          </div>
        </div>
      </section>

      <Benefits />

      <section className="container-site mt-12">
        <Title a="Mais" b="Desejados" to={{ secao: "mais-vendidos" }} />
        <Grid carousel items={forAudience(BEST_SELLERS.map((s) => getProduct(s)!), audience)} />
      </section>

      <section className="container-site mt-16">
        <Title a="Todos os" b="Combos" to={{ tiposProduto: "Combos" }} />
        <Grid carousel items={forAudience(products.filter((p) => p.category === "kits"), audience)} />
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
        <Grid carousel items={forAudience(products, audience).slice(0, 8)} />
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
