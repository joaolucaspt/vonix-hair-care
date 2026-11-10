import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles } from "lucide-react";

/**
 * A quiet editorial invitation after the product sections, not an offer card.
 * Applicant benefits and partnerships cannot be implied before selection.
 */
export function AffiliateHomeInvite() {
  return (
    <section
      aria-labelledby="vonix-afiliadas-convite-titulo"
      className="container-site mt-16 sm:mt-20"
      data-testid="vonix-affiliate-home-invite"
    >
      <div className="relative isolate overflow-hidden rounded-[1.6rem] border border-[#e5d0c4] bg-[#f8f0e9] px-6 py-9 text-[#472f37] sm:px-10 sm:py-11 lg:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-40 h-80 w-80 rounded-full bg-[#d5aab2]/25 blur-[75px]"
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[42rem]">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#915b66]">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Comunidade Vonix Hair
            </p>
            <h2
              id="vonix-afiliadas-convite-titulo"
              className="mt-3 font-display text-3xl leading-tight sm:text-4xl"
            >
              Seu conteúdo também faz parte do universo da beleza.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#735b60] sm:text-base">
              Cria conteúdo sobre cabelos e cuidados capilares? Conheça o processo de candidatura
              para o programa de afiliadas Vonix Hair. A inscrição é gratuita e a seleção não é
              automática.
            </p>
          </div>
          <Link
            to="/seja-afiliada"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#623a49] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7b4a5b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#623a49] lg:self-auto"
          >
            Conhecer o programa de afiliadas
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
