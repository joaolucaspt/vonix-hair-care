import { ArrowUpRight, Headset, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Factual brand credibility for prospects, sourced from the official
 * /sobre and /loja pages. Deliberately NOT creator testimonials, audience
 * metrics, income evidence, paid-campaign results or promises of perks.
 */
const brandFacts = [
  {
    title: "Produtos oficiais para conhecer",
    description:
      "Confira o catálogo vendido no site da Vonix e escolha os produtos sobre os quais você gostaria de aprender mais.",
    Icon: PackageCheck,
    href: "/loja",
    link: "Conhecer o catálogo",
  },
  {
    title: "Atendimento humano",
    description:
      "A Vonix apresenta os canais de contato e informações de atendimento em suas páginas institucionais.",
    Icon: Headset,
    href: "/sobre",
    link: "Conhecer a marca",
  },
  {
    title: "Entregas pelo Brasil",
    description:
      "A loja apresenta atendimento nacional. Frete, prazos e disponibilidade dependem do CEP e do pedido.",
    Icon: Truck,
    href: "/politica-de-frete",
    link: "Consultar entregas",
  },
] as const;

export function AffiliateBrandTrust({ recruitmentOpen }: { recruitmentOpen: boolean }) {
  return (
    <section
      id="conheca-a-vonix"
      data-testid="affiliate-c58-brand-trust"
      aria-labelledby="vonix-c58-brand-title"
      className="scroll-mt-28 overflow-hidden border-y border-[#eadbd7] bg-[#fbf5f1] px-5 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid min-w-0 items-center gap-9 lg:grid-cols-[.88fr_1.12fr] lg:gap-16">
          <figure className="relative min-w-0">
            <div
              className="absolute -left-8 -top-8 h-44 w-44 rounded-full bg-[#f2d9d4]/70 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-[2.2rem] border border-[#e9d2cd] bg-gradient-to-br from-[#f9e8e4] via-[#fffaf6] to-[#ebd5d2] p-5 shadow-[0_24px_70px_rgba(71,34,48,.10)] sm:p-8">
              <div className="grid grid-cols-[1.1fr_.9fr] items-center gap-3 sm:gap-6">
                <picture className="block aspect-[.9] overflow-hidden rounded-[1.5rem] bg-[#fffaf7]">
                  <source srcSet="/images/products/kit-cronograma-capilar.webp" type="image/webp" />
                  <img
                    src="/images/products/kit-cronograma-capilar.jpg"
                    alt="Kit Cronograma Capilar do catálogo oficial Vonix Hair"
                    width={640}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain p-3 sm:p-5"
                  />
                </picture>
                <picture className="block aspect-[.72] overflow-hidden rounded-[1.5rem] bg-white">
                  <source srcSet="/images/products/botox-vonix.webp" type="image/webp" />
                  <img
                    src="/images/products/botox-vonix.jpg"
                    alt="Embalagem do Botox Vonix do catálogo oficial"
                    width={500}
                    height={700}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain p-3 sm:p-5"
                  />
                </picture>
              </div>
              <figcaption className="mt-5 flex items-start gap-3 rounded-[1.1rem] border border-[#ead7d2] bg-white/90 px-4 py-4 text-xs leading-relaxed text-[#674e59] sm:text-sm">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#844c5c]" />
                Fotos dos próprios produtos Vonix Hair. Não são imagens de candidatas, creators ou
                resultados de parcerias.
              </figcaption>
            </div>
          </figure>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#874959]">
              Conheça a marca por trás do convite
            </p>
            <h2
              id="vonix-c58-brand-title"
              className="mt-4 font-display text-4xl leading-[1.12] text-[#442b35] sm:text-5xl"
            >
              Uma loja real.{" "}
              <span className="italic text-[#9b5a6c]">Uma parceria que começa com confiança.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#715c64] sm:text-base sm:leading-8">
              Antes de apresentar seu perfil, explore quem é a Vonix Hair: seus produtos, seu
              atendimento e as condições de compra divulgadas na loja oficial. Ter informações
              confiáveis ajuda você a decidir se a marca combina com a sua audiência.
            </p>
            <div className="mt-7 grid min-w-0 gap-3">
              {brandFacts.map(({ title, description, Icon, href, link }) => (
                <article
                  key={title}
                  className="flex min-w-0 items-start gap-4 rounded-[1.15rem] border border-[#e9dbd6] bg-white/90 p-4 sm:p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5e7e6] text-[#834d5b]">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl leading-tight text-[#442b35]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#715c64]">{description}</p>
                    <a
                      href={href}
                      className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#7e4152] underline underline-offset-4"
                    >
                      {link} <ArrowUpRight aria-hidden="true" className="size-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#e4d3cf] pt-6">
              <a
                href="#avaliacoes-produtos"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#7e4152] underline underline-offset-4"
              >
                Ver avaliações reais de produtos{" "}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
              <Button
                asChild
                className="h-auto min-h-12 rounded-full px-6 py-3 text-sm font-semibold"
              >
                <a href="#inscricao">
                  {recruitmentOpen ? "Quero apresentar meu perfil" : "Ver como se candidatar"}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </div>
            <p className="mt-4 max-w-xl text-xs leading-relaxed text-[#806b72]">
              Avaliações citadas neste portal são de clientes sobre produtos, não de afiliadas
              participantes. A candidatura não garante aprovação ou remuneração.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
