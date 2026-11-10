import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, Heart, Minus, Plus, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BuyDrawer } from "@/components/buy-drawer";
import { ProductGallery } from "@/components/product-gallery";
import { ProductDetails } from "@/components/product-details";
import { ProductReviews, reviewsFor } from "@/components/reviews";
import { ShareButton } from "@/components/share-button";
import { Grid, PaymentMethods, PixMark, SecuritySeal, Shell, Stars } from "@/components/site";
import { toItem, track } from "@/lib/analytics";
import { useServerFn } from "@tanstack/react-start";
import { lookupAddress } from "@/lib/address.functions";
import { quoteShipping } from "@/lib/checkout.functions";
import {
  FREE_SHIPPING_ABOVE,
  WHATSAPP,
  brl,
  discountPct,
  getProduct,
  SITE_URL,
  forAudience,
  getSavedCep,
  hasFreeShipping,
  lineTotals,
  maskCep,
  pixPrice,
  products,
  saveCep,
  useAudience,
  useCart,
  useFavorites,
  useHydrated,
  volumePct,
  type Product,
} from "@/lib/store";

export const Route = createFileRoute("/produto/$slug")({
  loader: ({ params }) => {
    const p = getProduct(params.slug);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData: p }) => {
    if (!p)
      return {
        meta: [
          { title: "Produto indisponível — Vonix Hair" },
          { name: "robots", content: "noindex" },
        ],
        links: [],
        scripts: [],
      };
    // Prévia no WhatsApp/Facebook e Google exigem endereço completo da imagem.
    const images = p.images.map((src) => (src.startsWith("http") ? src : `${SITE_URL}${src}`));
    const url = `${SITE_URL}/produto/${p.slug}`;
    const description = `${p.name} na Vonix Hair. Até 6x sem juros, até 5% no Pix em itens sem outra oferta. Frete grátis acima de R$ ${FREE_SHIPPING_ABOVE.toFixed(0)} sujeito à cotação do CEP.`;
    const rated = reviewsFor(p.slug);
    return {
      meta: [
        { title: `${p.name} — Vonix Hair` },
        { name: "description", content: description },
        { property: "og:title", content: `${p.name} — Vonix Hair` },
        { property: "og:description", content: description },
        { property: "og:image", content: images[0] },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        { name: "twitter:image", content: images[0] },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: p.short || p.name,
            image: images,
            sku: p.slug,
            brand: { "@type": "Brand", name: "Vonix Hair" },
            ...(rated.length
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(
                      1,
                    ),
                    reviewCount: rated.length,
                  },
                }
              : {}),
            offers: {
              "@type": "Offer",
              url,
              priceCurrency: "BRL",
              price: p.variants[0].price.toFixed(2),
              // Omit availability until live Bling stock can be verified for this SKU.
              itemCondition: "https://schema.org/NewCondition",
              hasMerchantReturnPolicy: {
                "@type": "MerchantReturnPolicy",
                applicableCountry: "BR",
                returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                merchantReturnDays: 7,
                returnMethod: "https://schema.org/ReturnByMail",
              },
            },
          }),
        },
      ],
    };
  },
  component: ProductPage,
});

export function ShippingCalc({
  subtotal,
  slug,
  variant,
  qty,
}: {
  subtotal: number;
  slug: string;
  variant: string;
  qty: number;
}) {
  const [cep, setCep] = useState("");
  const [dest, setDest] = useState<{ city: string; uf: string } | null>(null);
  const [opts, setOpts] = useState<
    { id: number; name: string; company: string; price: number; days: number; free: boolean }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const addressLookup = useServerFn(lookupAddress);
  const shippingLookup = useServerFn(quoteShipping);
  useEffect(() => {
    request.current += 1;
    setOpts([]);
    setDest(null);
    setLoading(false);
    setErr(null);
  }, [slug, variant, qty]);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setCep(saved);
  }, []);
  const calc = async () => {
    const current = ++request.current;
    const d = cep.replace(/\D/g, "");
    setDest(null);
    setOpts([]);
    setErr(null);
    if (d.length !== 8) {
      setErr("Digite um CEP válido no formato 00000-000.");
      return;
    }
    setLoading(true);
    saveCep(cep);
    // Address and carrier requests are independent. A hung address lookup
    // must never prevent a successful freight result from being actionable.
    void addressLookup({ data: { cep: d } })
      .then((r) => {
        if (current !== request.current) return;
        if (r.ok) setDest({ city: r.address.city, uf: r.address.uf });
        else setErr((old) => [old, r.message].filter(Boolean).join(" "));
      })
      .catch(() => {
        if (current === request.current)
          setErr((old) =>
            [old, "Endereço indisponível. Você pode preenchê-lo manualmente no checkout."]
              .filter(Boolean)
              .join(" "),
          );
      });

    // Even if the local API or a carrier never replies, restore the
    // calculation button and ignore any outdated result after the deadline.
    const watchdog = window.setTimeout(() => {
      if (current !== request.current) return;
      request.current += 1;
      setLoading(false);
      setOpts([]);
      setDest(null);
      setErr("O cálculo de frete demorou demais. Tente novamente ou consulte o atendimento.");
    }, 12000);
    try {
      const q = await shippingLookup({ data: { cep: d, items: [{ slug, variant, qty }] } });
      if (current !== request.current) return;
      setOpts(q.ok ? q.options : []);
      if (q.ok && q.options.length === 0)
        setErr((old) =>
          [
            old,
            "Não há opções de entrega para este CEP. Confira o endereço ou fale com nosso atendimento.",
          ]
            .filter(Boolean)
            .join(" "),
        );
      if (!q.ok) setErr((old) => [old, q.message].filter(Boolean).join(" "));
    } catch {
      if (current === request.current)
        setErr((old) =>
          [old, "Não foi possível calcular o frete agora. Tente novamente."]
            .filter(Boolean)
            .join(" "),
        );
    } finally {
      window.clearTimeout(watchdog);
      if (current === request.current) setLoading(false);
    }
  };
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-body font-medium">
        <Truck className="h-4 w-4" strokeWidth={1.5} />
        Calcular frete
      </div>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="numeric"
          placeholder="00000-000"
          value={cep}
          onChange={(e) => {
            request.current += 1;
            setCep(maskCep(e.target.value));
            setDest(null);
            setOpts([]);
            setErr(null);
            setLoading(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && calc()}
          aria-label="CEP de entrega"
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-body"
        />
        <button
          onClick={calc}
          disabled={loading}
          className="shrink-0 rounded-full border border-foreground bg-background px-5 text-body font-medium text-foreground disabled:opacity-60"
        >
          {loading ? "..." : "Calcular"}
        </button>
      </div>
      {err && <p className="mt-2 text-body text-destructive">{err}</p>}
      {(dest || opts.length > 0) && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-body">
          <p className="text-muted-foreground">
            {dest
              ? `Entrega para ${dest.city}/${dest.uf}`
              : `Estimativa de frete para o CEP ${cep}`}
          </p>
          {hasFreeShipping(subtotal) && opts.some((o) => o.free) && (
            <p className="mt-1 font-medium">
              Frete Grátis — pedido acima de {brl(FREE_SHIPPING_ABOVE)} em produtos, calculado antes
              dos descontos.
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {opts.map((o) => (
              <li key={o.id} className="flex justify-between gap-3">
                <span>
                  {o.company} {o.name}{" "}
                  <span className="text-muted-foreground">· até {o.days} dias úteis</span>
                </span>
                <b>{o.free ? "Grátis" : brl(o.price)}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Quick picks for the quantity. The discount itself follows the quantity (volumePct), however it is set (picks or +/-). */
const QTY_OPTIONS: { n: number; label: string }[] = [
  { n: 1, label: "1 unidade" },
  { n: 2, label: "Leve 2 unidades" },
  { n: 3, label: "Leve 3 unidades" },
];

function ProductPage() {
  const p = Route.useLoaderData();
  // TanStack Router may retain the same route component while only the slug
  // changes. Keying its purchase state by product prevents a previous SKU's
  // size, quantity or buy drawer from leaking into the next product.
  return <ProductPurchase key={p.slug} p={p} />;
}

function ProductPurchase({ p }: { p: Product }) {
  const cart = useCart();
  const fav = useFavorites();
  const hydrated = useHydrated();
  const { audience } = useAudience();
  const nav = useNavigate();
  const [vi, setVi] = useState(0);
  const [qty, setQty] = useState(1);
  const [buyOpen, setBuyOpen] = useState(false);
  const closeBuyDrawer = useCallback(() => setBuyOpen(false), []);
  const payFromDrawer = useCallback(() => {
    setBuyOpen(false);
    nav({ to: "/checkout" });
  }, [nav]);
  const v = p.variants[vi] ?? p.variants[0]!;
  const compare = vi === 0 ? p.compareBase : null;
  const off = discountPct(compare, v.price);
  const related = forAudience(
    products.filter((x) => x.category === p.category && x.slug !== p.slug),
    audience,
  ).slice(0, 4);
  const sel = lineTotals(v.price, qty);
  const discounted = sel.net < sel.gross;
  const unitPrice = sel.net / sel.units;
  useEffect(() => {
    track("view_item", { value: v.price, items: [toItem(p, v.label, v.price)] });
  }, [p, v.label, v.price]);
  const add = () => {
    cart.add(p.slug, v.label, qty);
    track("add_to_cart", {
      value: unitPrice * sel.units,
      items: [toItem(p, v.label, unitPrice, sel.units)],
    });
  };
  const total = sel.net;
  return (
    <Shell>
      {buyOpen && <BuyDrawer onClose={closeBuyDrawer} onPay={payFromDrawer} />}
      <div className="container-site py-8 pb-28 lg:pb-8">
        <nav className="mb-6 text-small text-muted-foreground">
          <Link to="/">Início</Link> /{" "}
          <Link to="/loja" search={{ categoria: p.category }}>
            {p.categoryLabel}
          </Link>{" "}
          / {p.name}
        </nav>
        <div className="grid gap-10 lg:grid-cols-2">
          <ProductGallery key={p.slug} images={p.images} name={p.name} />
          <div className="min-w-0">
            {off > 0 && (
              <span className="rounded-full bg-foreground px-3 py-1 text-small text-background">
                {off}% OFF
              </span>
            )}
            <h1 className="mt-3 font-display text-h1">{p.name}</h1>
            <Stars slug={p.slug} />
            <div className="mt-3">
              <ShareButton
                compact
                url={`${SITE_URL}/produto/${p.slug}`}
                title={`${p.name} — Vonix Hair`}
                text={`Olha esse produto da Vonix Hair: ${p.name}.`}
                label="Compartilhar"
              />
            </div>
            {p.short && <p className="mt-3 text-muted-foreground">{p.short}</p>}
            {
              <div className="mt-6">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div className="font-display text-h2 leading-tight">
                    {audience === "salao" ? "Condição por quantidade" : "Compre mais e economize"}
                  </div>
                  <div className="text-small text-muted-foreground">
                    mesmo produto, mesmo tamanho
                  </div>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Quantidade em promoção"
                  className="grid gap-2.5 sm:grid-cols-3 sm:gap-3"
                >
                  {QTY_OPTIONS.map((o, k) => {
                    const t = lineTotals(v.price, o.n);
                    const pct = volumePct(o.n);
                    const on = k === 0 ? qty === 1 : k === 1 ? qty === 2 : qty >= 3;
                    const best = k === QTY_OPTIONS.length - 1;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!hydrated}
                        onClick={() => setQty(o.n)}
                        className={`relative flex min-w-0 items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all sm:flex-col sm:items-start sm:gap-1.5 sm:p-4 ${on ? "border-[#c9992f] bg-[#fff8e8] shadow-[0_6px_18px_-8px_rgba(201,153,47,0.6)]" : "border-border bg-white hover:border-[#c9992f]/60"}`}
                      >
                        {best && (
                          <span className="absolute -top-2.5 right-3 rounded-full bg-[#7a5a2e] px-2.5 py-0.5 text-small font-semibold text-white">
                            Melhor preço
                          </span>
                        )}
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? "border-[#c9992f] bg-[#c9992f] text-white" : "border-border bg-white text-transparent"}`}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1 sm:w-full">
                          <span className="block text-body font-semibold leading-tight">
                            {o.label}
                          </span>
                          <span className="mt-0.5 block text-small text-muted-foreground">
                            {pct ? `${pct}% de desconto` : "Preço normal"}
                          </span>
                        </span>
                        <span className="text-right sm:w-full sm:text-left">
                          <span className="money block text-name font-semibold leading-tight">
                            {brl(t.net)}
                          </span>
                          {pct > 0 ? (
                            <span className="mt-1 inline-flex rounded-full bg-[#eef8f2] px-2 py-0.5 text-small font-medium text-[#2c6e55]">
                              Economize {brl(t.gross - t.net)}
                            </span>
                          ) : (
                            <span className="mt-1 block text-small text-muted-foreground">
                              {brl(v.price)} cada
                            </span>
                          )}
                          {pct > 0 && (
                            <span className="mt-0.5 block text-small text-muted-foreground">
                              {brl(t.net / t.units)} cada
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-2xl bg-[#faf6ee] px-4 py-3.5">
                  <div>
                    <div className="text-small text-muted-foreground">
                      Seu pedido · {sel.units} {sel.units === 1 ? "unidade" : "unidades"}
                      {discounted ? ` · ${volumePct(qty)}% OFF` : ""}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {discounted ? (
                        <span className="money text-muted-foreground line-through">
                          {brl(sel.gross)}
                        </span>
                      ) : compare && compare > v.price ? (
                        <span className="money text-muted-foreground line-through">
                          {brl(compare * sel.units)}
                        </span>
                      ) : null}
                      <span className="money text-h2 font-semibold leading-tight">
                        {brl(sel.net)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    {discounted ? (
                      <span className="money rounded-full bg-[#eef8f2] px-3 py-1 text-body font-semibold text-[#2c6e55]">
                        Você economiza {brl(sel.gross - sel.net)}
                      </span>
                    ) : (
                      <span className="money inline-flex items-center gap-1.5 rounded-full bg-[#eef8f2] px-3 py-1 text-body font-medium text-[#2c6e55]">
                        <PixMark className="h-4 w-4" /> {brl(pixPrice(sel.net))} no Pix
                      </span>
                    )}
                  </div>
                </div>
              </div>
            }
            {p.variants.length > 1 && (
              <div className="mt-6">
                <div className="mb-2 text-body font-medium">Tamanho</div>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map((x, k) => (
                    <button
                      key={x.label}
                      disabled={!hydrated}
                      onClick={() => setVi(k)}
                      type="button"
                      className={`min-h-11 rounded-full border px-4 py-2 text-body focus-visible:outline-2 focus-visible:outline-offset-2 ${k === vi ? "border-foreground bg-foreground text-background" : "border-border"}`}
                    >
                      {x.label} · {brl(x.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {p.variants.length === 1 && (
              <div className="mt-4 text-body text-muted-foreground">Tamanho: {v.label}</div>
            )}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-border">
                <button
                  type="button"
                  aria-label={`Diminuir quantidade de ${p.name}`}
                  disabled={!hydrated || qty <= 1}
                  className="grid min-h-11 min-w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center" data-testid="qty">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label={`Aumentar quantidade de ${p.name}`}
                  disabled={!hydrated || qty >= 99}
                  className="grid min-h-11 min-w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-small text-muted-foreground">unidade(s)</span>
              <button
                type="button"
                aria-label={`${fav.has(p.slug) ? "Remover" : "Adicionar"} ${p.name} ${fav.has(p.slug) ? "dos" : "aos"} favoritos`}
                aria-pressed={fav.has(p.slug)}
                disabled={!hydrated}
                onClick={() => fav.toggle(p.slug)}
                className="grid h-11 w-11 place-items-center rounded-full border border-border"
              >
                <Heart className={`h-4 w-4 ${fav.has(p.slug) ? "fill-foreground" : ""}`} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-md bg-emerald-600 font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-55 py-3.5"
                disabled={!hydrated}
                onClick={() => {
                  add();
                  setBuyOpen(true);
                }}
              >
                Comprar agora
              </button>
              <button
                className="rounded-md border-2 border-foreground py-3.5 font-medium disabled:cursor-wait disabled:opacity-55"
                disabled={!hydrated}
                onClick={() => {
                  add();
                  toast.success("Adicionado ao carrinho");
                }}
              >
                Adicionar ao carrinho
              </button>
            </div>
            <div className="mt-4">
              <PaymentMethods />
            </div>
            <div className="mt-3">
              <SecuritySeal />
            </div>
            <ShippingCalc subtotal={sel.gross} slug={p.slug} variant={v.label} qty={qty} />
            <ul className="mt-4 space-y-1 text-body text-muted-foreground">
              <li>
                Frete grátis em compras acima de {brl(FREE_SHIPPING_ABOVE)} em produtos, antes dos
                descontos, sujeito à cotação do CEP
              </li>
              <li>
                <Link
                  to="/$page"
                  params={{ page: "politica-de-trocas-e-devolucoes" }}
                  className="underline"
                >
                  7 dias para desistir da compra, conforme a lei
                </Link>
              </li>
              <li>
                <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">
                  Dúvidas? Fale com a gente no WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>
        {p.description && <ProductDetails p={p} />}
        <ProductReviews slug={p.slug} />
        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 [&_em]:not-italic">
              Você também pode <em>gostar</em>
            </h2>
            <Grid carousel items={related} />
          </section>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-background p-3 lg:hidden">
        <div className="min-w-0 leading-tight">
          <div className="truncate text-small text-muted-foreground">{p.name}</div>
          <div className="font-semibold">{brl(total)}</div>
          {!discounted && (
            <div className="money text-small font-semibold text-[#2c6e55]">
              {brl(pixPrice(total))} no Pix
            </div>
          )}
        </div>
        <button
          className="ml-auto shrink-0 rounded-md bg-emerald-600 font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-55 px-6 py-3 text-body"
          disabled={!hydrated}
          onClick={() => {
            add();
            setBuyOpen(true);
          }}
        >
          Comprar agora
        </button>
      </div>
    </Shell>
  );
}
