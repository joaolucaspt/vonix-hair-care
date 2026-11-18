import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Instagram } from "lucide-react";
import type { ReactNode } from "react";
import logoUrl from "@/assets/vonix-logo.webp";
import { INSTAGRAM } from "@/lib/store";

/**
 * Dedicated recruitment chrome: the store's search, product audiences, sales
 * ticker and shopping popup distract from the simplified application on mobile.
 * Keep that commerce layout untouched for every other route.
 */
export function AffiliateShell({
  children,
  mode = "landing",
}: {
  children: ReactNode;
  mode?: "landing" | "account";
}) {
  return (
    <div
      data-testid="vonix-affiliate-shell"
      className="min-h-screen min-w-0 bg-background text-foreground"
    >
      <style>{`
        [data-testid="vonix-affiliate-shell"] {
          --background: oklch(0.99 0.006 60); --foreground: oklch(0.28 0.04 10);
          --card: oklch(0.98 0.012 60); --card-foreground: var(--foreground);
          --primary: oklch(0.38 0.09 10); --primary-foreground: oklch(0.98 0.008 60);
          --secondary: oklch(0.92 0.025 30); --secondary-foreground: var(--foreground);
          --muted: oklch(0.94 0.018 60); --muted-foreground: oklch(0.43 0.04 10);
          --accent: oklch(0.90 0.035 20); --accent-foreground: var(--primary);
          --border: oklch(0.80 0.025 20); --input: var(--border); --ring: var(--primary);
          letter-spacing: 0;
        }
        [data-testid="vonix-affiliate-shell"] :is(a,button,input,summary):focus-visible {
          outline: 2px solid var(--ring); outline-offset: 4px;
        }
        [data-testid="vonix-affiliate-shell"] footer { --muted-foreground: var(--primary-foreground); }
        [data-testid="vonix-affiliate-shell"] footer a { min-height: 44px; display: inline-flex; align-items: center; }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="vonix-affiliate-shell"] *, [data-testid="vonix-affiliate-shell"] *::before, [data-testid="vonix-affiliate-shell"] *::after {
            animation: none !important; transition: none !important; scroll-behavior: auto !important;
          }
        }
      `}</style>
      <a
        href="#conteudo-afiliadas"
        className="sr-only rounded-md bg-background px-4 py-2 text-muted-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90]"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-background shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              to="/"
              aria-label="Voltar à loja Vonix Hair"
              className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <img
                src={logoUrl}
                alt="Vonix Hair"
                className="h-[2.6rem] w-auto object-contain"
                width={109}
                height={43}
              />
            </Link>
            <span aria-hidden="true" className="hidden h-6 w-px bg-background sm:block" />
            <span className="hidden text-[10px] font-bold uppercase tracking-normal text-muted-foreground sm:block">
              Universo de criadoras
            </span>
          </div>

          {mode === "landing" && (
            <nav
              aria-label="Navegação da seleção de afiliadas"
              className="hidden items-center gap-7 lg:flex"
            >
              <a
                href="#ganhos"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
              >
                Ganhos
              </a>
              <Link
                to="/consultar-candidatura"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
              >
                Status
              </Link>
              <a
                href="#criterios"
                className="text-sm font-medium text-muted-foreground transition hover:text-muted-foreground focus-visible:underline"
              >
                Para quem é
              </a>
              <a
                href="#como-funciona"
                className="text-sm font-medium text-muted-foreground transition hover:text-muted-foreground focus-visible:underline"
              >
                Como funciona
              </a>
              <a
                href="#formatos"
                className="text-sm font-medium text-muted-foreground transition hover:text-muted-foreground focus-visible:underline"
              >
                Inspirações
              </a>
              <a
                href="#duvidas"
                className="text-sm font-medium text-muted-foreground transition hover:text-muted-foreground focus-visible:underline"
              >
                Dúvidas
              </a>
            </nav>
          )}

          {mode === "landing" ? (
            <a
              href="#inscricao"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:px-5 sm:text-sm"
            >
              <span className="sm:hidden">Ver inscrição</span>
              <span className="hidden sm:inline">Conhecer a inscrição</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : (
            <Link
              to="/seja-afiliada"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground sm:px-5 sm:text-sm"
            >
              Programa de afiliadas <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>

      <main id="conteudo-afiliadas" tabIndex={-1}>
        {children}
      </main>

      <footer className="bg-primary px-5 py-12 text-muted-foreground sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Link
              to="/"
              aria-label="Ir para o e-commerce Vonix Hair"
              className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span
                role="img"
                aria-label="Vonix Hair"
                className="block h-12 w-[7.8rem]"
                style={{
                  aspectRatio: "420 / 163",
                  background:
                    "linear-gradient(135deg, #b8862b 0%, #f3d98a 38%, #c9992f 62%, #f0cf7a 100%)",
                  WebkitMaskImage: "url(" + logoUrl + ")",
                  maskImage: "url(" + logoUrl + ")",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskPosition: "left center",
                  maskPosition: "left center",
                }}
              />
            </Link>
            <p className="mt-4 max-w-lg text-sm leading-[1.8] text-muted-foreground">
              Inscrição e seleção de afiliadas Vonix Hair. A candidatura é gratuita, não garante
              aprovação ou benefícios comerciais e não constitui contrato.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 text-sm md:items-end">
            <Link
              to="/"
              className="inline-flex items-center gap-2 underline decoration-border underline-offset-4 hover:text-primary-foreground"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Visitar a loja oficial
            </Link>
            <Link
              to="/consultar-candidatura"
              className="underline decoration-border underline-offset-4 hover:text-primary-foreground"
            >
              Acompanhar inscrição por código
            </Link>
            {mode === "landing" && (
              <a
                href="#duvidas"
                className="underline decoration-border underline-offset-4 hover:text-primary-foreground"
              >
                Perguntas frequentes
              </a>
            )}
            <Link
              to="/acompanhar-inscricao"
              className="underline decoration-border underline-offset-4 hover:text-primary-foreground"
            >
              Inscrições antigas por e-mail
            </Link>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 underline decoration-border underline-offset-4 hover:text-primary-foreground"
            >
              <Instagram aria-hidden="true" className="h-4 w-4" /> Instagram da Vonix Hair
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-wrap justify-between gap-2 border-t border-white/20 pt-6 text-xs text-muted-foreground">
          <span>Vonix Hair · Programa de inscrição e seleção</span>
          <span>As condições de eventual parceria são comunicadas separadamente.</span>
        </div>
      </footer>
    </div>
  );
}
