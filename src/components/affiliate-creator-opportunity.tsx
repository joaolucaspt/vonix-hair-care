import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { illustrativeEarnings } from "@/lib/affiliate-marketing-math";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

/**
 * Product feedback quoted from the official Botox Vonix storefront, checked
 * on 2026-11-18. Not affiliate-program testimonials or earning claims.
 */
const verifiedProductFeedback = [
  { name: "Fernanda Assis", month: "setembro de 2026", quote: "Adoreeeeeiii" },
  {
    name: "Ayla Muniz",
    month: "agosto de 2026",
    quote: "Já peguei logo o combo kkkkkkk minhas cliente amou",
  },
  {
    name: "Mariana Andrade",
    month: "julho de 2026",
    quote: "Produto maravilhoso ❤️ eu amei trabalhar com ele",
  },
] as const;

export function AffiliateCreatorOpportunity({
  recruitmentOpen = false,
}: {
  recruitmentOpen?: boolean;
}) {
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
        <aside
          id="avaliacoes-produtos"
          aria-labelledby="vonix-product-reviews-title"
          className="scroll-mt-28 mt-14 overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_16px_45px_rgba(70,36,49,.06)]"
          data-testid="vonix-c53-real-product-reviews"
        >
          <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-8 sm:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">
                Avaliações publicadas na loja oficial
              </p>
              <h3
                id="vonix-product-reviews-title"
                className="mt-3 font-display text-3xl leading-tight text-foreground sm:text-4xl"
              >
                Quem conhece nossos produtos tem o que contar.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Opiniões sobre o Botox Vonix de clientes que aparecem na página do produto.
                <strong className="font-semibold">
                  {" "}
                  Não são depoimentos de afiliadas ou resultados do programa.
                </strong>
              </p>
            </div>
            <a
              href="/produto/botox-vonix"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Conferir avaliações na loja <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {verifiedProductFeedback.map((review) => (
              <blockquote key={review.name} className="min-w-0 bg-card px-6 py-8 sm:px-8">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Sobre o Botox Vonix
                </p>
                <p className="mt-5 font-display text-xl leading-snug text-foreground">
                  “{review.quote}”
                </p>
                <footer className="mt-6 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground">{review.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Cliente · {review.month}</p>
                </footer>
              </blockquote>
            ))}
          </div>
          <p className="bg-secondary/45 px-6 py-4 text-xs leading-relaxed text-muted-foreground sm:px-10">
            Estes comentários documentam experiências com produtos da Vonix Hair. Eles não
            representam renda, vendas, comissões ou participação no programa de afiliadas.
          </p>
        </aside>
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
              {recruitmentOpen ? "Preencher candidatura" : "Conhecer a candidatura"}{" "}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
