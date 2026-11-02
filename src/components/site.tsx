import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CreditCard, Facebook, Heart, Star, House, Instagram, Menu, QrCode, Scissors, Search, ShieldCheck, ShoppingBag, Truck, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoUrl from "@/assets/vonix-logo.webp";
import { PrizeWheel } from "@/components/prize-wheel";
import { reviewsFor } from "@/components/reviews";
import { toItem, track } from "@/lib/analytics";
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
  WHATSAPP,
  INSTAGRAM,
  FACEBOOK,
  type Audience,
  type Product,
} from "@/lib/store";

export const SRC = "https://vonixhaircosmeticos.com.br";
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
  "FRETE GRÁTIS ACIMA DE R$ 150 EM PRODUTOS, ANTES DOS DESCONTOS",
  "PARCELAMENTO EM ATÉ 6X SEM JUROS",
  "5% NO PIX EM ITENS SEM OUTRA OFERTA",
  "ESQUENTA BLACK FRIDAY",
];

const NAV = [
  { label: "Mais vendidos", search: { secao: "mais-vendidos" } },
  { label: "Produtos", search: {} },
  { label: "Progressiva", search: { tiposProduto: "Progressiva" } },
  { label: "Máscara", search: { tiposProduto: "Máscara" } },
  { label: "Combos", search: { tiposProduto: "Combos" } },
  { label: "Kera+", search: { q: "kera" } },
  { label: "Cachos", search: { q: "cachos" } },
];

/** Simplified WhatsApp mark: speech bubble with a handset (lucide has no brand icons). */
export function WhatsAppIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <g transform="translate(6.2 6.2) scale(0.5)" fill="currentColor" stroke="none">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </g>
    </svg>
  );
}

/** Payment methods the checkout really accepts (Appmax: Pix and credit card). Add boleto/wallets here only once they are built. */
export function PaymentMethods({ dark = false }: { dark?: boolean }) {
  const pill = `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-small font-semibold ${dark ? "border-marquee-foreground/35 text-marquee-foreground" : "border-border bg-white text-foreground"}`;
  return (
    <ul aria-label="Formas de pagamento" className="flex flex-wrap items-center gap-2">
      <li className={pill}>
        <span className="rounded bg-[#0a5c34] px-1 py-0.5 text-small font-semibold tracking-wider text-white">PIX</span> Pix · 5% OFF
      </li>
      <li className={pill}>
        <CreditCard className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" /> Cartão de crédito · até 6x sem juros
      </li>
    </ul>
  );
}

/** Security seal: only facts that hold (HTTPS on the host, payment processed by Appmax, card tokenized in the browser). No third-party certification is claimed. */
export function SecuritySeal({ dark = false }: { dark?: boolean }) {
  return (
    <div role="group" aria-label="Compra segura" className={`inline-flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${dark ? "border-marquee-foreground/35 text-marquee-foreground" : "border-border bg-white text-foreground"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-action text-action-foreground">
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <b className="block text-body">Compra 100% segura</b>
        <span className="block text-small opacity-75">Conexão criptografada · pagamento processado pela Appmax</span>
      </span>
    </div>
  );
}

/** Reassurance strip: only conditions the store already advertises. */
export function Benefits() {
  const items = [
    { Icon: Truck, title: "Frete grátis", text: `acima de R$ ${FREE_SHIPPING_ABOVE} em produtos` },
    { Icon: CreditCard, title: "Até 6x sem juros", text: "no cartão de crédito" },
    { Icon: QrCode, title: "5% OFF no Pix", text: "pagamento à vista" },
    { Icon: ShieldCheck, title: "Compra segura", text: "seus dados protegidos" },
  ];
  return (
    <section aria-label="Vantagens" className="container-site mt-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-action text-action-foreground">
              <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block text-body">{title}</b>
              <span className="block text-small text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SocialLinks() {
  const cls = "grid h-10 w-10 place-items-center rounded-full border border-marquee-foreground/40 transition-colors hover:bg-marquee-foreground hover:text-marquee";
  return (
    <div className="flex gap-3">
      <a href={INSTAGRAM} target="_blank" rel="noreferrer" aria-label="Instagram da Vonix Hair" className={cls}><Instagram className="h-5 w-5" /></a>
      <a href={FACEBOOK} target="_blank" rel="noreferrer" aria-label="Facebook da Vonix Hair" className={cls}><Facebook className="h-5 w-5" /></a>
      <a href={WHATSAPP} target="_blank" rel="noreferrer" aria-label="WhatsApp da Vonix Hair" className={cls}><WhatsAppIcon className="h-5 w-5" /></a>
    </div>
  );
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        nav({ to: "/loja", search: { q } });
        onDone?.();
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar produtos, combos, tratamentos..."
        aria-label="Buscar"
        className="h-11 w-full rounded-full border border-border bg-background px-4 pr-10 text-body outline-none focus:border-foreground"
      />
      <button aria-label="Buscar" className="absolute right-0 top-0 grid h-11 w-11 place-items-center">
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
      <section aria-label="Área escolhida" className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg bg-foreground px-3 py-2 text-background">
        <span className="min-w-0 text-small font-semibold sm:text-body">
          {audience === "salao" ? "Área para cabeleireiras" : "Para mim · cuidados em casa"}
        </span>
        <Button type="button" variant="outline" className="h-7 shrink-0 border-background bg-transparent px-3 text-small text-background hover:bg-background hover:text-foreground"
          onClick={() => { set(null); nav({ to: "/" }); }}>
          Trocar área
        </Button>
      </section>
    );
  return (
    <section aria-label="Escolha seu ambiente" className="w-full min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        {([
          { value: "casa", label: "PARA MIM", support: "Cuidados em casa", Icon: House },
          { value: "salao", label: "PARA CABELEIREIRAS", support: "Produtos para salão", Icon: Scissors },
        ] as const).map(({ value, label, support, Icon }) => (
          <Button key={value} type="button" variant="outline" aria-pressed={audience === value}
            onClick={() => go(value)}
            className={`h-auto min-h-16 min-w-0 gap-2 whitespace-normal border-foreground px-2 py-2 shadow-none ${audience === value ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "bg-background text-foreground hover:bg-muted"}`}>
            <Icon aria-hidden="true" />
            <span className="min-w-0 text-left"><span className="block text-small font-semibold sm:text-small">{label}</span><span className="block text-small font-normal">{support}</span></span>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const path = useLocation().pathname;
  const hideWhatsApp = path === "/carrinho" || path === "/checkout";
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="overflow-hidden bg-marquee py-2.5 text-small font-medium tracking-wide text-marquee-foreground">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i}>{m} &nbsp;✧</span>
          ))}
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="container-site flex items-center gap-4 py-3">
          <button className="-m-2 p-2 lg:hidden" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/" className="shrink-0">
            <img src={LOGO} alt="Vonix Hair" width={420} height={163} className="h-11 w-auto" />
          </Link>
          <p className="mx-auto min-w-0 flex-1 text-center text-body italic leading-tight lg:hidden">“Até aqui nos ajudou o Senhor”</p>
          <div className="mx-auto hidden min-w-0 w-full max-w-xl flex-col items-center gap-1.5 lg:flex">
            <p className="text-body italic">“Até aqui nos ajudou o Senhor”</p>
            <SearchBox />
            <AudienceChoice />
            <nav className="flex flex-wrap justify-center whitespace-nowrap gap-x-5 gap-y-1 text-small uppercase">
              {NAV.map((n) => (
                <Link key={n.label} to="/loja" search={n.search} className="shrink-0 hover:underline">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-4 text-body">
            <Link to="/favoritos" aria-label="Favoritos" className="-m-2 p-2">
              <Heart className="h-5 w-5" />
            </Link>
            <Link to="/conta" className="hidden items-center gap-1 sm:flex">
              <User className="h-4 w-4" /> Entrar
            </Link>
            <Link to="/carrinho" aria-label="Carrinho" className="relative -m-2 p-2">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0 -top-0 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-small text-background">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="container-site space-y-2 pb-3 lg:hidden">
          <SearchBox />
          <AudienceChoice />
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-foreground/50" onClick={() => setOpen(false)}>
          <aside
            className="h-full w-72 bg-background p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="mb-6">
              <X className="h-6 w-6" />
            </button>
            <nav className="flex flex-col gap-4 text-body uppercase">
              {NAV.map((n) => (
                <Link key={n.label} to="/loja" search={n.search} onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              ))}
              <Link to="/favoritos" onClick={() => setOpen(false)}>Favoritos</Link>
              <Link to="/conta" onClick={() => setOpen(false)}>Entrar / Meus pedidos</Link>
              <Link to="/carrinho" onClick={() => setOpen(false)}>Carrinho</Link>
            </nav>
          </aside>
        </div>
      )}
      <main>{children}</main>
      <Footer />
      <PrizeWheel />
      {!hideWhatsApp && (
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noreferrer"
          aria-label="Falar no WhatsApp"
          className={`fixed right-5 z-40 grid ${path.startsWith("/produto/") ? "bottom-24 lg:bottom-5" : "bottom-5"} h-14 w-14 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg`}
        >
          <WhatsAppIcon className="h-8 w-8" />
        </a>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-20 bg-marquee text-marquee-foreground">
      <div className="container-site grid gap-6 border-b border-marquee-foreground/15 py-6 text-center text-body sm:grid-cols-4">
        <span>Entrega para todo o Brasil</span>
        <span>Compra 100% segura</span>
        <span>Até 6x sem juros no cartão</span>
        <span>Frete grátis acima de R$ 150 em produtos</span>
      </div>
      <div className="container-site grid gap-10 py-12 text-body sm:grid-cols-4">
        <div>
          <div className="mb-4"><GoldLogo className="h-14" /></div>
          <p className="opacity-80">
            Cosméticos capilares profissionais, com entrega para todo o Brasil.
          </p>
        </div>
        <div className="flex flex-col gap-1 [&_a]:py-1.5">
          <h4 className="mb-2 font-semibold">Comprar</h4>
          <Link to="/loja">Todos os Produtos</Link>
          <Link to="/loja" search={{ tiposProduto: "Combos" }}>Combos</Link>
          <Link to="/loja" search={{ tiposProduto: "Finalizadores" }}>Finalizadores</Link>
          <Link to="/loja" search={{ necessidades: "Hidratação" }}>Hidratação</Link>
        </div>
        <div className="flex flex-col gap-1 [&_a]:py-1.5">
          <h4 className="mb-2 font-semibold">Ajuda</h4>
          <Link to="/$page" params={{ page: "sobre" }}>Sobre a Vonix Hair</Link>
          <Link to="/conta">Meus pedidos</Link>
          <Link to="/favoritos">Favoritos</Link>
          <Link to="/$page" params={{ page: "contato" }}>Contato</Link>
        </div>
        <div className="flex flex-col gap-2 opacity-90">
          <h4 className="mb-2 font-semibold">Atendimento</h4>
          <span>Seg. a sex., 9h às 18h</span>
          <span className="break-all">contato@vonixhaircosmeticos.com.br</span>
          <span>Rua José Pedro de Carvalho, 30 — MG</span>
          <span>CNPJ: 68.272.005/0001-07</span>
          <div className="mt-2"><SocialLinks /></div>
        </div>
      </div>
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-marquee-foreground/15 py-5 text-body">
        <span className="font-semibold">Formas de pagamento</span>
        <PaymentMethods dark />
        <SecuritySeal dark />
      </div>
      <div className="container-site flex flex-wrap justify-between gap-3 border-t border-marquee-foreground/15 py-5 text-small opacity-80">
        <span>© 2026 Vonix Hair. Todos os direitos reservados.</span>
        <div className="flex flex-wrap gap-x-4 gap-y-0 [&_a]:py-2">
          <Link to="/$page" params={{ page: "politica-de-privacidade" }}>Política de Privacidade</Link>
          <Link to="/$page" params={{ page: "termos-de-uso" }}>Termos de Uso</Link>
          <Link to="/$page" params={{ page: "politica-de-trocas-e-devolucoes" }}>Política de Troca e Devoluções</Link>
          <Link to="/$page" params={{ page: "politica-de-frete" }}>Política de Frete</Link>
        </div>
      </div>
    </footer>
  );
}

export function PriceBlock({ price, compare, big, offer = false }: { price: number; compare?: number | null; big?: boolean; offer?: boolean }) {
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
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-[#b9e5cd] bg-[#e7f6ee] text-[#0a5c34] ${big ? "px-4 py-3" : "px-2.5 py-1.5"}`}>
          <span className="rounded bg-[#0a5c34] px-1.5 py-0.5 text-small font-semibold tracking-wider text-white">PIX</span>
          <b className={big ? "text-h2" : "text-body"}>{brl(pixPrice(price))}</b>
          <span className={`font-semibold ${big ? "text-body" : "text-small"}`}>5% OFF à vista</span>
        </div>
      )}
      <div className={`flex items-center gap-1.5 font-medium ${big ? "text-body" : "text-small"}`}>
        <CreditCard className={big ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.6} aria-hidden="true" />
        <span>{i.count}x de <b>{brl(i.value)}</b> sem juros no cartão</span>
      </div>
    </div>
  );
}

/**
 * Real average rating (from src/data/reviews.json): gold stars filled in proportion to the score, plus the number.
 * A product with no reviews yet shows the five empty stars, never an invented score.
 */
export function Stars({ slug, big = false }: { slug: string; big?: boolean }) {
  const list = reviewsFor(slug);
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const label = avg.toFixed(1).replace(".", ",");
  const size = big ? "h-3 w-3" : "h-3.5 w-3.5";
  const five = (filled: boolean) => (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={`${size} shrink-0 ${filled ? "fill-current" : ""}`} strokeWidth={1.6} />
      ))}
    </span>
  );
  return (
    <div className="flex items-center gap-2 text-small" role="img" aria-label={list.length ? `Nota ${label} de 5` : "Ainda sem avaliações"}>
      <span className="relative inline-block text-[#d4a22f]" aria-hidden="true">
        {five(false)}
        {avg > 0 && (
          <span className="absolute inset-y-0 left-0 overflow-hidden text-[#e9b01f]" style={{ width: `${(avg / 5) * 100}%` }}>
            {five(true)}
          </span>
        )}
      </span>
      {list.length > 0 && <b className="text-body">{label}</b>}
    </div>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const fav = useFavorites();
  const { audience } = useAudience();
  const pricing = cardPricing(p, audience);
  const off = discountPct(p.compareBase, pricing.price);
  const cart = useCart();
  const nav = useNavigate();
  const par = installments(pricing.price);
  // Products with a single size are added straight to the bag; the rest open the product page to choose.
  const bag = () => {
    if (p.variants.length > 1 || pricing.professional) {
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
          aria-label="Favoritar"
          onClick={() => fav.toggle(p.slug)}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background"
        >
          <Heart className={`h-4 w-4 ${fav.has(p.slug) ? "fill-foreground" : ""}`} />
        </button>
        <Link to="/produto/$slug" params={{ slug: p.slug }}>
          <img src={p.images[0]} alt={`Vonix Hair ${p.name}`} loading="lazy" className="aspect-[6/5] w-full object-contain transition-transform duration-500 group-hover:scale-105 md:aspect-square" />
        </Link>
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1">
        {hasFreeShipping(pricing.price) && (
          <span className="inline-flex items-center gap-1 rounded-md bg-action px-1.5 py-0.5 text-small font-semibold tracking-wide text-action-foreground">
            <Truck className="h-3 w-3" aria-hidden="true" /> FRETE GRÁTIS
          </span>
        )}
        {pricing.professional && (
          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-small font-semibold tracking-wide text-background">LEVE 2: 12% · LEVE 3: 15%</span>
        )}
      </div>
      <Link to="/produto/$slug" params={{ slug: p.slug }} className="mt-0.5 line-clamp-2 min-h-[2.4rem] text-name font-semibold leading-tight hover:underline md:leading-snug">
        {p.name}
      </Link>
      <div className="mt-1.5"><Stars slug={p.slug} big /></div>
      <div className="mt-1.5 flex items-end justify-between gap-1.5">
        <div className="min-w-0 leading-tight">
          {p.compareBase && p.compareBase > pricing.price && <div className="text-small text-muted-foreground line-through">{brl(p.compareBase)}</div>}
          <div className="text-price font-semibold">{brl(pricing.price)}</div>
          <div className="text-small font-medium">{par.count}x {brl(par.value)}<span className="hidden font-normal text-muted-foreground sm:inline"> sem juros</span></div>
        </div>
        <button
          type="button"
          onClick={bag}
          aria-label={p.variants.length > 1 || pricing.professional ? `Escolher opções de ${p.name}` : `Adicionar ${p.name} à sacola`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-action text-action-foreground shadow-sm transition-transform active:scale-95 md:h-11 md:w-11"
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#b9e5cd] bg-[#e7f6ee] px-1.5 py-1 text-[#0a5c34]">
        <span className="rounded bg-[#0a5c34] px-1 py-0.5 text-small font-semibold tracking-wider text-white">PIX</span>
        <b className="text-small md:text-body">{brl(pixPrice(pricing.price))}</b>
        <span className="text-small font-semibold md:text-small">-5%</span>
      </div>
      {p.short && <p className="mt-1.5 line-clamp-2 flex-1 text-small leading-snug text-muted-foreground md:line-clamp-3 md:text-small">{p.short}</p>}
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

  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const goTo = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  const btn = "grid h-9 w-9 place-items-center rounded-lg border border-[#7a5a2e] bg-white text-[#7a5a2e] transition-opacity disabled:opacity-30";

  return (
    <div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((p) => (
          <div key={p.slug} className="w-[66%] shrink-0 snap-start sm:w-[45%] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]">
            <ProductCard p={p} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" aria-label="Anterior" disabled={page === 0} onClick={() => go(-1)} className={btn}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4" role="tablist" aria-label="Páginas">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={`Página ${i + 1}`}
                onClick={() => goTo(i)}
                className={`relative h-2 rounded-full transition-all before:absolute before:-inset-2 before:content-[''] ${i === page ? "w-6 bg-[#7a5a2e]" : "w-2 bg-[oklch(0.8_0.01_85)]"}`}
              />
            ))}
          </div>
          <button type="button" aria-label="Próximo" disabled={page === pages - 1} onClick={() => go(1)} className={btn}>
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
    s.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part,
    );
  return (
    <div className="space-y-3 leading-relaxed">
      {text.split(/\n{2,}/).map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t === "---") return <hr key={i} className="border-border" />;
        if (t.startsWith("# ")) return <h1 key={i} className="font-display text-h1">{t.slice(2)}</h1>;
        if (t.startsWith("## ")) return <h2 key={i} className="pt-3 text-name font-semibold">{t.slice(3)}</h2>;
        const ls = t.split("\n");
        if (ls.every((l) => /^(- |\d+\. )/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {ls.map((l, j) => <li key={j}>{inline(l.replace(/^(- |\d+\. )/, ""))}</li>)}
            </ul>
          );
        return (
          <p key={i}>
            {ls.map((l, j) => (
              <span key={j}>{inline(l)}{j < ls.length - 1 && <br />}</span>
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
