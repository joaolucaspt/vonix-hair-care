import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Facebook,
  Heart,
  Star,
  House,
  Instagram,
  Menu,
  QrCode,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoUrl from "@/assets/vonix-logo.webp";
import { PrizeWheel } from "@/components/prize-wheel";
import { AffiliatePopup } from "@/components/affiliate-popup";
import { reviewsFor } from "@/components/reviews";
import { soldFor, SALES_SNAPSHOT_DATE } from "@/lib/sales";
import { useVisitorSummary } from "@/lib/review-summary";
import { PaymentLogos } from "@/components/payment-logos";
import { toItem, track } from "@/lib/analytics";
import { TRACKING_PREFERENCES_EVENT } from "@/lib/tracking-consent";
import {
  FREE_SHIPPING_ABOVE,
  MAX_DISCOUNT,
  brl,
  discountPct,
  hasFreeShipping,
  installments,
  pixPrice,
  cardPricing,
  useAudience,
  useCart,
  useFavorites,
  useHydrated,
  WHATSAPP,
  INSTAGRAM,
  FACEBOOK,
  type Audience,
  type Product,
} from "@/lib/store";

export const LOGO = logoUrl;

/** Logo painted in the brand's metallic gold (uses the logo's shape as a mask); for dark backgrounds. */
function GoldLogo({ className = "h-12" }: { className?: string }) {
  const mask = `url(${LOGO})`;
  return (
    <span
      role="img"
      aria-label="Vonix Hair"
      className={`block ${className}`}
      style={{
        aspectRatio: "420 / 163",
        background: "linear-gradient(135deg, #b8862b 0%, #f3d98a 38%, #c9992f 62%, #f0cf7a 100%)",
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  );
}

const MARQUEE = [
  `ATÉ ${MAX_DISCOUNT}% OFF EM PRODUTOS SELECIONADOS`,
  "FRETE GRÁTIS ACIMA DE R$ 150 EM PRODUTOS, SUJEITO À COTAÇÃO DO CEP",
  "PARCELAMENTO EM ATÉ 6X SEM JUROS",
  "5% NO PIX EM ITENS SEM OUTRA OFERTA",
];

const NAV = [
  { label: "Mais vendidos", search: { secao: "mais-vendidos" } },
  { label: "Produtos", search: {} },
  { label: "Progressiva", search: { tiposProduto: "Progressiva" } },
  { label: "Máscara", search: { tiposProduto: "Máscara" } },
  { label: "Kits", search: { tiposProduto: "Kits" } },
  { label: "Cachos", search: { q: "cachos" } },
];

/** Simplified WhatsApp mark: speech bubble with a handset (lucide has no brand icons). */
export function WhatsAppIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <g transform="translate(6.2 6.2) scale(0.5)" fill="currentColor" stroke="none">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}

/** Símbolo oficial do Pix (losango), na cor da marca. */
export function PixMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Pix"
      className={`shrink-0 ${className}`}
      fill="#32BCAD"
    >
      <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
    </svg>
  );
}

/** Payment methods the checkout really accepts (Appmax: Pix and credit card). Add boleto/wallets here only once they are built. */
export function PaymentMethods({ dark = false }: { dark?: boolean }) {
  const pill = `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-small font-semibold ${dark ? "border-marquee-foreground/35 text-marquee-foreground" : "border-border bg-white text-foreground"}`;
  return (
    <ul aria-label="Formas de pagamento" className="flex flex-wrap items-center gap-2">
      <li className={pill}>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#dff1e8] px-2 text-small font-medium text-[#2c6e55]">
          <PixMark />
          Pix
        </span>{" "}
        até 5% em itens sem outra oferta
      </li>
      <li className={pill}>
        <CreditCard className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" /> Cartão de crédito ·
        até 6x sem juros
      </li>
    </ul>
  );
}

/** Security seal: only facts that hold (HTTPS on the host, payment processed by Appmax, card tokenized in the browser). No third-party certification is claimed. */
export function SecuritySeal({ dark = false }: { dark?: boolean }) {
  return (
    <div
      role="group"
      aria-label="Compra segura"
      className={`inline-flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${dark ? "border-marquee-foreground/35 text-marquee-foreground" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${dark ? "bg-action text-action-foreground" : "bg-emerald-600 text-white"}`}
      >
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <b className="block text-body">Pagamento protegido</b>
        <span className="block text-small opacity-75">
          Conexão criptografada · cartão validado pela Appmax quando disponível
        </span>
      </span>
    </div>
  );
}

/** Reassurance strip: only conditions the store already advertises. */
export function Benefits() {
  const items = [
    {
      Icon: Truck,
      title: "Frete por CEP",
      text: `grátis acima de R$ ${FREE_SHIPPING_ABOVE}, conforme cotação`,
    },
    { Icon: CreditCard, title: "Até 6x sem juros", text: "no cartão de crédito" },
    { Icon: QrCode, title: "Até 5% no Pix", text: "somente itens sem outra oferta" },
    { Icon: ShieldCheck, title: "Compra segura", text: "seus dados protegidos" },
  ];
  return (
    <section aria-label="Vantagens" className="container-site mt-4">
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map(({ Icon, title, text }) => (
          <li
            key={title}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-action text-action-foreground">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block text-small font-semibold">{title}</b>
              <span className="block text-small leading-tight text-muted-foreground max-sm:hidden">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SocialLinks() {
  const cls =
    "grid h-10 w-10 place-items-center rounded-full border border-marquee-foreground/40 transition-colors hover:bg-marquee-foreground hover:text-marquee";
  return (
    <div className="flex gap-3">
      <a
        href={INSTAGRAM}
        target="_blank"
        rel="noreferrer"
        aria-label="Instagram da Vonix Hair"
        className={cls}
      >
        <Instagram className="h-5 w-5" />
      </a>
      <a
        href={FACEBOOK}
        target="_blank"
        rel="noreferrer"
        aria-label="Facebook da Vonix Hair"
        className={cls}
      >
        <Facebook className="h-5 w-5" />
      </a>
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp da Vonix Hair"
        className={cls}
      >
        <WhatsAppIcon className="h-5 w-5" />
      </a>
    </div>
  );
}

function SearchBox({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      action="/loja"
      method="get"
      role="search"
      aria-label="Pesquisar produtos Vonix Hair"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        nav({ to: "/loja", search: { q } });
        onDone?.();
      }}
    >
      <input
        type="search"
        name="q"
        maxLength={120}
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar produtos, kits, tratamentos..."
        aria-label="Buscar"
        autoFocus={autoFocus}
        className="h-11 w-full rounded-full border border-border bg-background px-4 pr-10 text-body outline-none focus:border-foreground"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

function AudienceChoice() {
  const { audience, set } = useAudience();
  const nav = useNavigate();
  const go = (a: Audience) => {
    set(a);
    nav({ to: "/loja", search: a ? { uso: a } : {} });
  };
  if (audience)
    return (
      <section
        aria-label="Área escolhida"
        className="mx-auto flex w-fit max-w-full min-w-0 items-center gap-3 rounded-full border border-foreground/25 bg-transparent px-5 py-1.5 text-foreground"
      >
        <span className="flex min-w-0 items-center gap-2 text-small font-medium uppercase tracking-[0.12em]">
          {audience === "salao" ? (
            <Scissors className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <House className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">
            {audience === "salao" ? "Área para cabeleireiras" : "Para mim · cuidados em casa"}
          </span>
        </span>
        <button
          type="button"
          className="shrink-0 text-small underline underline-offset-4 hover:no-underline"
          onClick={() => {
            set(null);
            nav({ to: "/" });
          }}
        >
          Trocar
        </button>
      </section>
    );
  return (
    <section aria-label="Escolha seu ambiente" className="w-full min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        {(
          [
            { value: "casa", label: "PARA MIM", support: "Cuidados em casa", Icon: House },
            {
              value: "salao",
              label: "PARA CABELEIREIRAS",
              support: "Produtos para salão",
              Icon: Scissors,
            },
          ] as const
        ).map(({ value, label, support, Icon }) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            aria-pressed={audience === value}
            onClick={() => go(value)}
            className={`h-auto min-h-16 min-w-0 gap-2 whitespace-normal border-foreground px-2 py-2 shadow-none ${audience === value ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "bg-background text-foreground hover:bg-muted"}`}
          >
            <Icon aria-hidden="true" />
            <span className="min-w-0 text-left">
              <span className="block text-small font-semibold sm:text-small">{label}</span>
              <span className="block text-small font-normal">{support}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const menuOpenerRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuDialogRef = useRef<HTMLElement>(null);
  const path = useLocation().pathname;
  const router = useRouter();
  const hideWhatsApp = path === "/carrinho" || path === "/checkout";
  const isProduct = path.startsWith("/produto/");
  const isCheckout = path === "/checkout";
  const hydrated = useHydrated();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = menuDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuOpenerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div
        className={`overflow-hidden bg-marquee py-2.5 text-small font-medium tracking-wide text-marquee-foreground ${isCheckout ? "hidden" : ""}`}
      >
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i}>{m} &nbsp;✧</span>
          ))}
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="container-site grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2 lg:flex lg:items-start lg:gap-4 lg:py-2">
          {isCheckout ? (
            // No checkout o topo é mínimo: o espaço do menu fica reservado para o logo continuar centralizado.
            <span aria-hidden="true" className="h-6 w-6 justify-self-start lg:hidden" />
          ) : (
            <button
              ref={menuOpenerRef}
              type="button"
              className="-m-2 justify-self-start p-2"
              aria-label="Abrir menu"
              aria-expanded={open}
              aria-controls="vonix-menu-rapido"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <Link to="/" className="shrink-0">
            <img
              src={LOGO}
              alt="Vonix Hair"
              width={420}
              height={163}
              className="h-8 w-auto sm:h-11"
            />
          </Link>
          {!isCheckout && (
            <div className="mx-auto hidden min-w-0 w-full max-w-xl flex-col items-center gap-1.5 lg:flex">
              <p className="text-body italic">“Até aqui nos ajudou o Senhor”</p>
              <SearchBox />
              <AudienceChoice />
            </div>
          )}
          <div className="ml-auto flex items-center justify-self-end gap-2 text-body sm:gap-4">
            {isProduct &&
              (hydrated ? (
                <button
                  type="button"
                  aria-label="Buscar"
                  aria-expanded={searchOpen}
                  aria-controls="vonix-product-mobile-search"
                  onClick={() => setSearchOpen((v) => !v)}
                  className="-m-2 p-2 lg:hidden"
                >
                  <Search className="h-5 w-5" />
                </button>
              ) : (
                // SSR fallback: a link must work even if JavaScript hasn't hydrated.
                <Link to="/loja" aria-label="Buscar produtos" className="-m-2 p-2 lg:hidden">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </Link>
              ))}
            {!isCheckout && (
              <Link to="/favoritos" aria-label="Favoritos" className="-m-2 p-2">
                <Heart className="h-5 w-5" />
              </Link>
            )}
            {!isCheckout && (
              <Link
                to="/conta"
                aria-label="Acompanhar pedido"
                className="flex items-center gap-1 text-small sm:text-body"
              >
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
                <span className={isProduct ? "hidden lg:inline" : "max-[359px]:hidden"}>
                  Pedidos
                </span>
              </Link>
            )}
            <Link to="/carrinho" aria-label="Carrinho" className="relative -m-2 p-2">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0 -top-0 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-small text-background">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        {isProduct
          ? // Página de produto no celular: só a busca, e só depois de tocar na lupa.
            searchOpen && (
              <div id="vonix-product-mobile-search" className="container-site pb-3 lg:hidden">
                <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
              </div>
            )
          : !isCheckout && (
              <div className="container-site space-y-2 pb-3 lg:hidden">
                <p className="whitespace-nowrap text-center text-body italic">
                  “Até aqui nos ajudou o Senhor”
                </p>
                <SearchBox />
                <AudienceChoice />
              </div>
            )}
        {!isCheckout && (
          <nav aria-label="Categorias" className="hidden border-t border-border lg:block">
            <div className="container-site flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3 text-small font-medium uppercase tracking-[0.15em] xl:gap-x-9">
              {NAV.map((n) => (
                <Link
                  key={n.label}
                  to="/loja"
                  search={n.search}
                  className="shrink-0 whitespace-nowrap border-b border-transparent pb-0.5 transition-colors hover:border-foreground"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to="/seja-afiliada"
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#a27b62]/35 bg-[#f8ede5] px-3 text-[11px] font-bold tracking-[.1em] text-[#684639] transition hover:bg-[#f1ddcb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#725345]"
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Seja afiliada
              </Link>
            </div>
          </nav>
        )}
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/50" onClick={() => setOpen(false)}>
          <aside
            ref={menuDialogRef}
            id="vonix-menu-rapido"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vonix-menu-rapido-titulo"
            tabIndex={-1}
            className="h-full w-80 max-w-[85vw] overflow-y-auto bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="vonix-menu-rapido-titulo" className="sr-only">
              Menu rápido
            </h2>
            <div className="mb-6 flex items-center gap-3">
              <Link
                to="/conta"
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-foreground px-3 py-2.5 text-center text-small font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background"
              >
                <User className="h-4 w-4 shrink-0" aria-hidden="true" /> Acompanhar pedido
              </Link>
              <button
                ref={menuCloseRef}
                type="button"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="-m-2 shrink-0 p-2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <h3 className="mb-3 text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Categorias
            </h3>
            <nav className="flex flex-col text-body [&_a]:border-b [&_a]:border-border [&_a]:py-3">
              {NAV.map((n) => (
                <Link key={n.label} to="/loja" search={n.search} onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <Link
              to="/seja-afiliada"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#e7d5cc] bg-[#fbf1eb] px-4 py-3 text-[#623b45] hover:bg-[#f4e4dc]"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Sparkles aria-hidden="true" className="h-4 w-4" /> Seja afiliada
              </span>
              <ArrowLeft aria-hidden="true" className="h-4 w-4 rotate-180" />
            </Link>
            <h3 className="mb-3 mt-8 text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Por necessidade
            </h3>
            <nav className="flex flex-col text-body [&_a]:border-b [&_a]:border-border [&_a]:py-3">
              {[
                "Hidratação",
                "Reconstrução",
                "Controle de Frizz",
                "Definição de Cachos",
                "Cabelos com Química",
                "Nutrição",
              ].map((n) => (
                <Link
                  key={n}
                  to="/loja"
                  search={{ necessidades: n }}
                  onClick={() => setOpen(false)}
                >
                  {n}
                </Link>
              ))}
            </nav>
            <h3 className="mb-3 mt-8 text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Atalhos
            </h3>
            <nav className="flex flex-col text-body [&_a]:border-b [&_a]:border-border [&_a]:py-3">
              <Link to="/favoritos" onClick={() => setOpen(false)}>
                Favoritos
              </Link>
              <Link to="/carrinho" onClick={() => setOpen(false)}>
                Carrinho
              </Link>
            </nav>
          </aside>
        </div>
      )}
      {path !== "/" && (
        <div className="container-site flex flex-wrap items-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Voltar"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2.5 text-small transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
          </button>
          {!isCheckout && (
            <Link
              to="/loja"
              className="inline-flex min-h-11 items-center rounded-full px-3 py-2.5 text-small font-medium text-muted-foreground underline underline-offset-4 transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Explorar loja
            </Link>
          )}
        </div>
      )}
      <main>{children}</main>
      <Footer />
      <PrizeWheel />
      <AffiliatePopup />
      {!hideWhatsApp && (
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar no WhatsApp"
          className={`fixed right-5 z-40 grid ${isProduct ? "bottom-24 max-lg:hidden lg:bottom-5" : "bottom-5"} h-14 w-14 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg`}
        >
          <WhatsAppIcon className="h-8 w-8" />
        </a>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 bg-marquee text-marquee-foreground">
      <div className="container-site grid gap-6 border-b border-marquee-foreground/15 py-6 text-center text-body sm:grid-cols-4">
        <span>Entrega para todo o Brasil</span>
        <span>Compra com conexão protegida</span>
        <span>Até 6x sem juros no cartão</span>
        <span>Frete grátis acima de R$ 150 em produtos, sujeito ao CEP</span>
      </div>
      <div className="container-site grid gap-8 py-8 text-body sm:grid-cols-4">
        <div>
          <div className="mb-4">
            <GoldLogo className="h-14" />
          </div>
          <p className="opacity-80">
            Cosméticos capilares profissionais, com entrega para todo o Brasil.
          </p>
        </div>
        <div className="flex flex-col gap-1 [&_a]:py-3.5">
          <h4 className="mb-2 font-semibold">Comprar</h4>
          <Link to="/loja">Todos os Produtos</Link>
          <Link to="/loja" search={{ tiposProduto: "Kits" }}>
            Kits
          </Link>
          <Link to="/loja" search={{ tiposProduto: "Finalizadores" }}>
            Finalizadores
          </Link>
          <Link to="/loja" search={{ necessidades: "Hidratação" }}>
            Hidratação
          </Link>
        </div>
        <div className="flex flex-col gap-1 [&_a]:py-3.5">
          <h4 className="mb-2 font-semibold">Ajuda</h4>
          <Link to="/$page" params={{ page: "sobre" }}>
            Sobre a Vonix Hair
          </Link>
          <Link to="/conta">Meus pedidos</Link>
          <Link to="/favoritos">Favoritos</Link>
          <Link to="/$page" params={{ page: "contato" }}>
            Contato
          </Link>
          <h4 className="mb-1 mt-4 font-semibold">Comunidade Vonix</h4>
          <Link
            to="/seja-afiliada"
            className="font-semibold text-[#eed4b5] underline decoration-[#eed4b5]/50 underline-offset-4 hover:text-white"
          >
            Programa de afiliadas
          </Link>
        </div>
        <div className="flex flex-col gap-2 opacity-90">
          <h4 className="mb-2 font-semibold">Atendimento</h4>
          <span>Seg. a sex., 9h às 18h</span>
          <span className="break-all">contato@vonixhaircosmeticos.com.br</span>
          <span>Rua José Pedro de Carvalho, 30 — MG</span>
          <span>CNPJ: 68.272.005/0001-07</span>
          <div className="mt-2">
            <SocialLinks />
          </div>
        </div>
      </div>
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-marquee-foreground/15 py-5 text-body">
        <span className="font-semibold">Formas de pagamento</span>
        <PaymentMethods dark />
        <SecuritySeal dark />
      </div>
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-marquee-foreground/15 py-5 text-body">
        <span className="font-semibold">Meios de pagamento</span>
        <PaymentLogos />
      </div>
      <div className="container-site flex flex-wrap justify-between gap-3 border-t border-marquee-foreground/15 py-5 text-small opacity-80">
        <span>© 2026 Vonix Hair. Todos os direitos reservados.</span>
        <div className="flex flex-wrap gap-x-4 gap-y-0 [&_a]:py-3.5">
          <Link to="/$page" params={{ page: "politica-de-privacidade" }}>
            Política de Privacidade
          </Link>
          <button
            type="button"
            className="min-h-11 text-left underline-offset-2 hover:underline focus-visible:outline-2"
            onClick={() => window.dispatchEvent(new Event(TRACKING_PREFERENCES_EVENT))}
          >
            Preferências de cookies
          </button>
          <Link to="/$page" params={{ page: "termos-de-uso" }}>
            Termos de Uso
          </Link>
          <Link to="/$page" params={{ page: "politica-de-trocas-e-devolucoes" }}>
            Política de Troca e Devoluções
          </Link>
          <Link to="/$page" params={{ page: "politica-de-frete" }}>
            Política de Frete
          </Link>
          <Link to="/seja-afiliada">Seja afiliada</Link>
        </div>
      </div>
    </footer>
  );
}

export function PriceBlock({
  price,
  compare,
  big,
  offer = false,
}: {
  price: number;
  compare?: number | null;
  big?: boolean;
  offer?: boolean;
}) {
  const i = installments(price);
  return (
    <div className={big ? "space-y-2" : "space-y-1.5 text-body"}>
      <div className="flex items-baseline gap-2">
        {compare && compare > price && (
          <span className="text-muted-foreground line-through">{brl(compare)}</span>
        )}
        <span className={big ? "text-h2 font-semibold" : "font-semibold"}>{brl(price)}</span>
      </div>
      {!offer && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl bg-[#eef8f2] text-[#2c6e55] ${big ? "px-4 py-3" : "px-3 py-1.5"}`}
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-small font-medium text-[#2c6e55]">
            <PixMark />
            Pix
          </span>
          <b className={`font-semibold ${big ? "text-h2" : "text-body"}`}>{brl(pixPrice(price))}</b>
          <span className={`font-medium ${big ? "text-body" : "text-small"}`}>
            5% de desconto à vista
          </span>
        </div>
      )}
      <div className={`flex items-center gap-1.5 font-medium ${big ? "text-body" : "text-small"}`}>
        <CreditCard className={big ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.6} aria-hidden="true" />
        <span>
          {i.count}x de <b>{brl(i.value)}</b> sem juros no cartão
        </span>
      </div>
    </div>
  );
}

/**
 * Real average rating (from src/data/reviews.json): gold stars filled in proportion to the score, plus the number.
 * A product with no reviews yet shows the five empty stars, never an invented score.
 */
const NO_STARS = new Set(["botox-vonix"]);

export function Stars({
  slug,
  big = false,
  hideEmpty = false,
}: {
  slug: string;
  big?: boolean;
  hideEmpty?: boolean;
}) {
  const list = reviewsFor(slug);
  const sold = soldFor(slug);
  // Clientes (reviews.json) + avaliações de visitantes já aprovadas (banco): as duas contam para a nota.
  const vis = useVisitorSummary()[slug];
  const count = list.length + (vis?.[0] ?? 0);
  const avg = count ? (list.reduce((s, r) => s + r.rating, 0) + (vis?.[1] ?? 0)) / count : 0;
  const label = avg.toFixed(1).replace(".", ",");
  const size = big ? "h-3 w-3" : "h-3.5 w-3.5";
  const five = (filled: boolean) => (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`${size} shrink-0 ${filled ? "fill-current" : ""}`}
          strokeWidth={1.6}
        />
      ))}
    </span>
  );
  // Nos cards, produto sem nota não mostra as cinco estrelas vazias (parecem "ninguém gostou"); fica só o número de vendidos.
  // Produtos em que a loja prefere não exibir a nota em estrelas (só o número de vendidos).
  const noRating = NO_STARS.has(slug);
  const showStars = !noRating && (count > 0 || !hideEmpty);
  return (
    <div
      className="flex min-h-[1.25rem] items-center gap-2 text-small"
      role="img"
      aria-label={`${count ? `Nota ${label} de 5, ${count} avaliações` : "Ainda sem avaliações"}${sold > 0 ? `. ${sold} unidades vendidas conforme histórico informado até ${SALES_SNAPSHOT_DATE}` : ""}`}
    >
      {showStars && (
        <span className="relative inline-block text-[#d4a22f]" aria-hidden="true">
          {five(false)}
          {avg > 0 && (
            <span
              className="absolute inset-y-0 left-0 overflow-hidden text-[#e9b01f]"
              style={{ width: `${(avg / 5) * 100}%` }}
            >
              {five(true)}
            </span>
          )}
        </span>
      )}
      {count > 0 && !noRating && <b className="text-body">{label}</b>}
      {sold > 0 && (
        <span
          className="text-muted-foreground"
          title={`Vendas históricas informadas pela loja até ${SALES_SNAPSHOT_DATE}; não são dados ao vivo`}
        >
          {showStars ? "· " : ""}
          {sold} {sold === 1 ? "vendido" : "vendidos"}
        </span>
      )}
    </div>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const fav = useFavorites();
  const hydrated = useHydrated();
  const { audience } = useAudience();
  const pricing = cardPricing(p, audience);
  const off = discountPct(p.compareBase, pricing.price);
  const cart = useCart();
  const nav = useNavigate();
  const par = installments(pricing.price);
  // Products with a single size are added straight to the bag; the rest open the product page to choose.
  const bag = () => {
    if (p.variants.length > 1) {
      nav({ to: "/produto/$slug", params: { slug: p.slug } });
      return;
    }
    const v = p.variants[0];
    cart.add(p.slug, v.label, 1);
    track("add_to_cart", { value: v.price, items: [toItem(p, v.label, v.price)] });
    toast.success(`${p.name} adicionado à sacola`);
  };
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-border bg-white p-2.5 shadow-sm md:p-3">
      <div className="relative overflow-hidden rounded-xl bg-white">
        {off > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-[#7a5a2e] px-1.5 py-0.5 text-small font-semibold text-white">
            -{off}%
          </span>
        )}
        <button
          aria-label={`${fav.has(p.slug) ? "Remover" : "Adicionar"} ${p.name} ${fav.has(p.slug) ? "dos" : "aos"} favoritos`}
          aria-pressed={fav.has(p.slug)}
          disabled={!hydrated}
          onClick={() => fav.toggle(p.slug)}
          className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-background shadow-sm focus-visible:outline-2"
        >
          <Heart className={`h-4 w-4 ${fav.has(p.slug) ? "fill-foreground" : ""}`} />
        </button>
        <Link to="/produto/$slug" params={{ slug: p.slug }}>
          <img
            src={p.images[0]}
            alt={`Vonix Hair ${p.name}`}
            loading="lazy"
            className="aspect-square w-full scale-110 object-contain transition-transform duration-500 group-hover:scale-[1.18]"
          />
        </Link>
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1">
        {hasFreeShipping(pricing.price) && (
          <span className="inline-flex items-center gap-1 rounded-md bg-action px-1.5 py-0.5 text-small font-semibold tracking-wide text-action-foreground">
            <Truck className="h-3 w-3" aria-hidden="true" /> FRETE GRÁTIS POR CEP
          </span>
        )}
        {pricing.professional && (
          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-small font-semibold tracking-wide text-background">
            LEVE 2: 12% · LEVE 3: 15%
          </span>
        )}
      </div>
      <Link
        to="/produto/$slug"
        params={{ slug: p.slug }}
        className="mt-0.5 line-clamp-2 min-h-[2.4rem] text-name font-semibold leading-tight hover:underline md:leading-snug"
      >
        {p.name}
      </Link>
      <div className="mt-1.5">
        <Stars slug={p.slug} big hideEmpty />
      </div>
      <div className="mt-1.5">
        <div className="min-w-0 leading-tight">
          {p.compareBase && p.compareBase > pricing.price && (
            <div className="text-small text-muted-foreground line-through">
              {brl(p.compareBase)}
            </div>
          )}
          <div className="text-price font-semibold">{brl(pricing.price)}</div>
          <div className="text-small font-medium">
            {par.count}x {brl(par.value)}
            <span className="hidden font-normal text-muted-foreground sm:inline"> sem juros</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap rounded-full bg-[#eef8f2] px-1.5 py-1 text-[#2c6e55] md:gap-1.5 md:px-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-small font-medium">
          <PixMark />
          <span className="max-md:hidden">Pix</span>
        </span>
        <b className="text-small font-semibold md:text-body">{brl(pixPrice(pricing.price))}</b>
        <span className="text-small font-medium max-sm:hidden">-5%</span>
      </div>
      {p.short && (
        <p className="mt-1.5 line-clamp-2 flex-1 text-small leading-snug text-muted-foreground md:line-clamp-3 md:text-small">
          {p.short}
        </p>
      )}
      {hydrated ? (
        <button
          type="button"
          onClick={bag}
          aria-label={
            p.variants.length > 1 ? `Escolher opções de ${p.name}` : `Adicionar ${p.name} à sacola`
          }
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-action px-3 py-3 text-center text-body font-semibold text-action-foreground shadow-sm transition hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {p.variants.length > 1 ? "Escolher tamanho" : "Adicionar à sacola"}
        </button>
      ) : (
        <Link
          to="/produto/$slug"
          params={{ slug: p.slug }}
          aria-label={`Ver produto ${p.name}`}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-action px-3 py-3 text-center text-body font-semibold text-action-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          Ver produto
        </Link>
      )}
    </div>
  );
}

/**
 * Swipeable product row with arrows and page dots. Phones show about one and a half cards
 * (the next one peeks in) and the page still scrolls up and down normally.
 */
function ProductCarousel({ items }: { items: Product[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    const total = Math.max(1, Math.ceil((el.scrollWidth - 4) / el.clientWidth));
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setPages(total);
    setPage(atEnd ? total - 1 : Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    el?.addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    return () => {
      el?.removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
    };
  }, [measure, items.length]);

  const go = (dir: number) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const goTo = (i: number) =>
    ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#7a5a2e] bg-white text-[#7a5a2e] transition-opacity focus-visible:outline-2 disabled:opacity-30";

  return (
    <div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((p) => (
          <div
            key={p.slug}
            className="w-[66%] shrink-0 snap-start sm:w-[45%] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]"
          >
            <ProductCard p={p} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label="Anterior"
            disabled={page === 0}
            onClick={() => go(-1)}
            className={btn}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            className="flex min-w-0 items-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Páginas"
          >
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={`Página ${i + 1}`}
                onClick={() => goTo(i)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 rounded-full transition-all ${i === page ? "w-6 bg-[#7a5a2e]" : "w-2 bg-[oklch(0.8_0.01_85)]"}`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Próximo"
            disabled={page === pages - 1}
            onClick={() => go(1)}
            className={btn}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Product list: a grid, or (with `carousel`) a swipeable row with arrows and dots. */
export function Grid({ items, carousel = false }: { items: Product[]; carousel?: boolean }) {
  return (
    <div className="rounded-2xl bg-[oklch(0.955_0.004_85)] p-2.5 md:p-4">
      {carousel ? (
        <ProductCarousel items={items} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Minimal markdown renderer for verified source texts. */
export function Md({ text }: { text: string }) {
  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*)/)
      .map((part, i) => (part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part));
  return (
    <div className="space-y-3 leading-relaxed">
      {text.split(/\n{2,}/).map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t === "---") return <hr key={i} className="border-border" />;
        if (t.startsWith("# "))
          return (
            <h1 key={i} className="font-display text-h1">
              {t.slice(2)}
            </h1>
          );
        if (t.startsWith("## "))
          return (
            <h2 key={i} className="pt-3 text-name font-semibold">
              {t.slice(3)}
            </h2>
          );
        const ls = t.split("\n");
        if (ls.every((l) => /^(- |\d+\. )/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {ls.map((l, j) => (
                <li key={j}>{inline(l.replace(/^(- |\d+\. )/, ""))}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {ls.map((l, j) => (
              <span key={j}>
                {inline(l)}
                {j < ls.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="container-site max-w-3xl py-12">{children}</div>;
}
