import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Instagram } from "lucide-react";
import type { ReactNode } from "react";
import logoUrl from "@/assets/vonix-logo.webp";
import { INSTAGRAM } from "@/lib/store";

/**
 * Dedicated recruitment chrome: the store's search, product audiences, sales
 * ticker and shopping popup distract from a five-step application on mobile.
 * Keep that commerce layout untouched for every other route.
 */
export function AffiliateShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="vonix-affiliate-shell"
      className="min-h-screen overflow-x-clip bg-[#fffaf7] text-[#35242b]"
    >
      <a
        href="#conteudo-afiliadas"
        className="sr-only rounded-md bg-white px-4 py-2 text-[#482d38] focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90]"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-50 border-b border-[#e8d6cf]/80 bg-[#fffaf7]/95 shadow-[0_3px_18px_rgba(64,32,43,.035)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/"
              aria-label="Voltar à loja Vonix Hair"
              className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#864f5e]"
            >
              <img
                src={logoUrl}
                alt="Vonix Hair"
                className="h-[2.6rem] w-auto object-contain"
                width={109}
                height={43}
              />
            </Link>
            <span aria-hidden="true" className="hidden h-6 w-px bg-[#d8bfb7] sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-[.25em] text-[#885b64] sm:block">
              Universo de criadoras
            </span>
          </div>

          <nav
            aria-label="Navegação da seleção de afiliadas"
            className="hidden items-center gap-7 lg:flex"
          >
            <a
              href="#criterios"
              className="text-sm font-medium text-[#725760] transition hover:text-[#492c38] focus-visible:underline"
            >
              Para quem é
            </a>
            <a
              href="#como-funciona"
              className="text-sm font-medium text-[#725760] transition hover:text-[#492c38] focus-visible:underline"
            >
              Como funciona
            </a>
            <a
              href="#formatos"
              className="text-sm font-medium text-[#725760] transition hover:text-[#492c38] focus-visible:underline"
            >
              Inspirações
            </a>
            <a
              href="#duvidas"
              className="text-sm font-medium text-[#725760] transition hover:text-[#492c38] focus-visible:underline"
            >
              Dúvidas
            </a>
          </nav>

          <a
            href="#inscricao"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#56303f] px-4 text-xs font-semibold text-white transition hover:bg-[#754959] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#56303f] sm:px-5 sm:text-sm"
          >
            <span className="sm:hidden">Ver inscrição</span>
            <span className="hidden sm:inline">Conhecer a inscrição</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main id="conteudo-afiliadas" tabIndex={-1}>
        {children}
      </main>

      <footer className="bg-[#281922] px-5 py-12 text-[#f9e9e3] sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Link
              to="/"
              aria-label="Ir para o e-commerce Vonix Hair"
              className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <img
                src={logoUrl}
                alt="Vonix Hair"
                width={115}
                height={45}
                className="h-12 w-auto rounded bg-white p-1.5"
              />
            </Link>
            <p className="mt-4 max-w-lg text-sm leading-[1.8] text-[#ead5d3]">
              Inscrição e seleção de afiliadas Vonix Hair. A candidatura é gratuita, não garante
              aprovação ou benefícios comerciais e não constitui contrato.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 text-sm md:items-end">
            <Link
              to="/"
              className="inline-flex items-center gap-2 underline decoration-[#bc9e9c] underline-offset-4 hover:text-white"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Visitar a loja oficial
            </Link>
            <a
              href="#duvidas"
              className="underline decoration-[#bc9e9c] underline-offset-4 hover:text-white"
            >
              Perguntas frequentes
            </a>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 underline decoration-[#bc9e9c] underline-offset-4 hover:text-white"
            >
              <Instagram aria-hidden="true" className="h-4 w-4" /> Instagram da Vonix Hair
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-wrap justify-between gap-2 border-t border-white/20 pt-6 text-xs text-[#c6b0b5]">
          <span>Vonix Hair · Programa de inscrição e seleção</span>
          <span>As condições de eventual parceria são comunicadas separadamente.</span>
        </div>
      </footer>
    </div>
  );
}
