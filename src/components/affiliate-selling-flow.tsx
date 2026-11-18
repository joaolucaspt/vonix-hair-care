import { ArrowUpRight, Check, Link2, ShoppingBag, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Educational illustration of the published Vonix affiliate terms.
 * Uses only authentic catalog assets. No collaborator, order, income,
 * commission payout or completed partnership is fabricated.
 */
const steps = [
  {
    number: "01",
    eyebrow: "A SUA INDICAÇÃO",
    title: "Seu conteúdo. Seu link.",
    description:
      "Após aprovação e habilitação da parceria, compartilhe o link divulgado pela equipe com quem se interessa pelos cuidados capilares.",
    image: "/images/products/kit-banana-e-mel.webp",
    fallback: "/images/products/kit-banana-e-mel.jpg",
    alt: "Fotografia de catálogo do Kit Banana e Mel Vonix Hair",
    Icon: Link2,
  },
  {
    number: "02",
    eyebrow: "A LOJA OFICIAL",
    title: "A cliente compra na Vonix.",
    description:
      "A compra acontece pelos canais oficiais, com preço do site. A Vonix Hair organiza o pedido, a entrega e o atendimento.",
    image: "/images/products/mascara-reparacao-nutri-repair.webp",
    fallback: "/images/products/mascara-reparacao-nutri-repair.jpg",
    alt: "Fotografia de catálogo da Máscara Nutri Repair Vonix Hair",
    Icon: ShoppingBag,
  },
  {
    number: "03",
    eyebrow: "VENDA CONFIRMADA",
    title: "Sua comissão pode acontecer.",
    description:
      "Vendas elegíveis, confirmadas e pagas contam com comissão anunciada de 8%, conforme as regras da parceria.",
    image: "/images/products/botox-vonix.webp",
    fallback: "/images/products/botox-vonix.jpg",
    alt: "Fotografia de catálogo do Botox Vonix Hair",
    Icon: WalletCards,
  },
] as const;

export function AffiliateSellingFlow({ recruitmentOpen }: { recruitmentOpen: boolean }) {
  return (
    <section
      id="jornada-afiliada"
      aria-labelledby="vonix-selling-flow-title"
      data-testid="vonix-c57-selling-flow"
      className="scroll-mt-24 bg-[#f9f1ed] px-5 py-16 text-[#46303b] sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#824656]">
              Depois de aprovada
            </p>
            <h2
              id="vonix-selling-flow-title"
              className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] sm:text-5xl lg:text-[3.5rem]"
            >
              Você cria a conexão.{" "}
              <span className="italic text-[#955968]">A Vonix cuida da experiência de compra.</span>
            </h2>
          </div>
          <div className="max-w-lg lg:pb-2">
            <p className="text-sm leading-7 text-[#725d63] sm:text-base">
              Veja de forma simples como uma indicação pode virar uma venda. É uma explicação do
              funcionamento anunciado, não um histórico de vendas ou uma promessa de ganhos.
            </p>
            <a
              href="#ganhos"
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#693440] underline underline-offset-4"
            >
              Entender as condições <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {steps.map(({ number, eyebrow, title, description, image, fallback, alt, Icon }) => (
            <article
              key={number}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-[1.65rem] border border-[#eadad6] bg-white shadow-[0_16px_55px_rgba(82,35,55,.055)]"
            >
              <div className="relative flex min-h-[14.5rem] items-center justify-center overflow-hidden bg-[#fffaf6] sm:min-h-[17rem]">
                <picture className="block h-52 w-full sm:h-60">
                  <source srcSet={image} type="image/webp" />
                  <img
                    src={fallback}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={640}
                    className="h-full w-full object-contain p-6 transition-transform duration-500 motion-safe:group-hover:scale-105 motion-reduce:transform-none"
                  />
                </picture>
                <span className="absolute left-5 top-5 flex size-10 items-center justify-center rounded-full bg-[#693440] font-display text-lg text-white">
                  {number}
                </span>
              </div>
              <div className="flex flex-1 flex-col px-6 pb-7 pt-6">
                <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[.13em] text-[#955968]">
                  <Icon aria-hidden="true" className="size-4" />
                  {eyebrow}
                </div>
                <h3 className="mt-3 font-display text-2xl leading-tight">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-[#725d63]">{description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-9 flex flex-col justify-between gap-6 overflow-hidden rounded-[1.75rem] bg-[#593140] px-6 py-7 text-white sm:flex-row sm:items-center sm:px-9">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#f3d6d9]">
              <Check aria-hidden="true" className="size-4" /> Primeiro, a candidatura
            </p>
            <h3 className="mt-3 font-display text-2xl leading-tight sm:text-3xl">
              Sua primeira etapa é apresentar seu perfil.
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#f3dee2] sm:text-sm">
              Inscrição gratuita. A aprovação e as condições comerciais são avaliadas
              individualmente. Nenhum link ou comissão é liberado só por preencher o formulário.
            </p>
          </div>
          <Button
            asChild
            className="h-auto min-h-12 shrink-0 rounded-full bg-white px-6 py-3 font-bold text-[#593140] hover:bg-[#f6e6e8]"
          >
            <a href="#inscricao">
              {recruitmentOpen ? "Quero me candidatar" : "Conhecer a inscrição"}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
