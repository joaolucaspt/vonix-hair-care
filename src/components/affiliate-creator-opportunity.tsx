import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Illustrative arithmetic only; never used to settle commissions or qualify bonuses. */
export function illustrativeEarnings(input: number) {
  const sales = Number.isFinite(input) ? Math.min(20000, Math.max(0, input)) : 0;
  const salesCents = Math.round(sales * 100);
  const commissionCents = Math.round((salesCents * 8) / 100);
  const bonusCents = Math.floor(salesCents / 1000000) * 50000;
  return {
    sales: salesCents / 100,
    commission: commissionCents / 100,
    bonus: bonusCents / 100,
    total: (commissionCents + bonusCents) / 100,
  };
}

export function AffiliateEarningsSimulator() {
  const [sales, setSales] = useState(2500);
  const result = illustrativeEarnings(sales);
  return (
    <div
      className="mt-12 border-y border-border py-8 sm:py-12"
      role="group"
      aria-labelledby="simulator-title"
    >
      <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">Exemplo, não projeção</p>
          <h3 id="simulator-title" className="mt-3 font-display text-3xl">
            Simulador ilustrativo
          </h3>
          <p
            id="simulator-conditions"
            className="mt-4 text-sm leading-relaxed text-muted-foreground"
          >
            Não é promessa de ganhos. Depende de aprovação, vendas confirmadas e pagas e regras de
            elegibilidade do bônus. O exemplo não verifica sua elegibilidade.
          </p>
          <label
            htmlFor="illustrative-sales"
            className="mt-7 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold"
          >
            Valor hipotético de vendas{" "}
            <span className="text-lg tabular-nums">{money.format(result.sales)}</span>
          </label>
          <input
            id="illustrative-sales"
            type="range"
            min={0}
            max={20000}
            step={500}
            value={sales}
            aria-describedby="simulator-conditions"
            aria-valuetext={money.format(result.sales)}
            onChange={(event) => setSales(Number(event.target.value))}
            className="mt-3 min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          />
          <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
            <span>R$ 0</span>
            <span>R$ 20.000</span>
          </div>
        </div>
        <output
          htmlFor="illustrative-sales"
          aria-live="polite"
          aria-atomic="true"
          className="block min-w-0 self-center"
        >
          <dl className="space-y-5">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Comissão ilustrativa · 8%</dt>
              <dd data-testid="illustrative-commission" className="font-semibold tabular-nums">
                {money.format(result.commission)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Bônus condicional*</dt>
              <dd data-testid="illustrative-bonus" className="font-semibold tabular-nums">
                {money.format(result.bonus)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-5">
              <dt className="self-center font-semibold">Soma demonstrativa*</dt>
              <dd
                data-testid="illustrative-total"
                className="font-display text-4xl text-primary tabular-nums"
              >
                {money.format(result.total)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            *Inclui R$ 500 por cada R$ 10.000 apenas como hipótese de bônus elegível. Sem
            elegibilidade, o bônus não se aplica. Não representa pagamento, saldo ou previsão de
            renda.
          </p>
        </output>
      </div>
    </div>
  );
}

const catalog = [
  {
    slug: "kit-banana-e-mel",
    title: "Kit Banana e Mel",
    text: "Rotina e cuidado",
    alt: "Embalagens oficiais do Kit Banana e Mel comercializado na loja Vonix Hair",
  },
  {
    slug: "mascara-reparacao-nutri-repair",
    title: "Máscara Nutri Repair",
    text: "Texturas e detalhes",
    alt: "Embalagem oficial da Máscara de Reparação Nutri Repair da Vonix Hair",
  },
  {
    slug: "botox-vonix",
    title: "Botox Vonix",
    text: "Universo profissional",
    alt: "Pote original do Botox Vonix da loja oficial Vonix Hair",
  },
];

export function AffiliateCreatorOpportunity() {
  return (
    <section aria-labelledby="creator-stories-title" className="bg-card px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase text-primary">
          O catálogo como ponto de partida
        </p>
        <h2
          id="creator-stories-title"
          className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-5xl"
        >
          Uma marca para conhecer.{" "}
          <span className="italic text-primary">Muitas histórias para criar.</span>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Conheça os produtos, suas indicações e o universo da marca. Sua experiência pessoal pode
          inspirar uma rotina, uma resenha ou um olhar sobre os detalhes — sempre com sinceridade e
          respeito às orientações de uso.
        </p>
        <div className="mt-10 grid min-w-0 gap-8 sm:grid-cols-3">
          {catalog.map((product) => (
            <figure key={product.slug} className="min-w-0">
              <picture className="block aspect-square bg-background">
                <source srcSet={`/images/products/${product.slug}.webp`} type="image/webp" />
                <img
                  src={`/images/products/${product.slug}.jpg`}
                  alt={product.alt}
                  width={768}
                  height={768}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain p-6"
                />
              </picture>
              <figcaption className="mt-5 border-t border-border pt-4">
                <p className="text-xs uppercase text-muted-foreground">{product.text}</p>
                <h3 className="mt-2 font-display text-2xl">{product.title}</h3>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-7">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Galeria de produtos reais da loja oficial. Não são depoimentos de afiliadas,
            experiências de creators ou evidências de ganhos do programa.{" "}
            <a href="/loja" className="font-semibold text-primary underline underline-offset-4">
              Conheça o catálogo na loja oficial
            </a>
            .
          </p>
          <Button asChild className="min-h-12 h-auto whitespace-normal px-6 py-3">
            <a href="#inscricao">
              Conhecer a candidatura <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
