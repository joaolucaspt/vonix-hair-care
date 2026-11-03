import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, Heart, Minus, Plus, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProductGallery } from "@/components/product-gallery";
import { ProductDetails } from "@/components/product-details";
import { ProductReviews } from "@/components/reviews";
import { ShareButton } from "@/components/share-button";
import { Grid, PaymentMethods, PixMark, SecuritySeal, Shell, Stars } from "@/components/site";
import { toItem, track } from "@/lib/analytics";
import { quoteShipping } from "@/lib/checkout.functions";
import { FREE_SHIPPING_ABOVE, WHATSAPP, brl, discountPct, getProduct, SITE_URL, forAudience, getSavedCep, hasFreeShipping, lineTotals, maskCep, pixPrice, products, saveCep, useAudience, useCart, useFavorites, volumePct } from "@/lib/store";

export const Route = createFileRoute("/produto/$slug")({
  loader: ({ params }) => {
    const p = getProduct(params.slug);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData: p }) => ({
    meta: p
      ? [
          { title: `${p.name} — Vonix Hair` },
          { name: "description", content: p.short || p.name },
          { property: "og:title", content: `${p.name} — Vonix Hair` },
          { property: "og:description", content: p.short || p.name },
          { property: "og:image", content: p.images[0] },
          { property: "og:type", content: "product" },
          { name: "twitter:image", content: p.images[0] },
        ]
      : [{ title: "Produto indisponível — Vonix Hair" }, { name: "robots", content: "noindex" }],
    links: p ? [{ rel: "canonical", href: `${SITE_URL}/produto/${p.slug}` }] : [],
    scripts: p
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: p.name,
              description: p.short || p.name,
              image: p.images,
              sku: p.slug,
              brand: { "@type": "Brand", name: "Vonix Hair" },
              offers: {
                "@type": "Offer",
                url: `${SITE_URL}/produto/${p.slug}`,
                priceCurrency: "BRL",
                price: p.variants[0].price.toFixed(2),
                availability: "https://schema.org/InStock",
                itemCondition: "https://schema.org/NewCondition",
              },
            }),
          },
        ]
      : [],
  }),
  component: ProductPage,
});

function ShippingCalc({ subtotal, slug, variant, qty }: { subtotal: number; slug: string; variant: string; qty: number }) {
  const [cep, setCep] = useState("");
  const [dest, setDest] = useState<{ city: string; uf: string } | null>(null);
  const [opts, setOpts] = useState<{ id: number; name: string; company: string; price: number; days: number; free: boolean }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setCep(saved);
  }, []);
  const calc = async () => {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) {
      setErr("Digite um CEP válido no formato 00000-000.");
      setDest(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
      if (r.erro) {
        setErr("CEP não encontrado.");
        setDest(null);
        return;
      }
      saveCep(cep);
      setDest({ city: r.localidade, uf: r.uf });
      const q = await quoteShipping({ data: { cep: d, items: [{ slug, variant, qty }] } });
      setOpts(q.ok ? q.options : []);
      if (!q.ok) setErr(q.message);
    } catch {
      setErr("Não foi possível consultar o CEP. Tente novamente.");
    } finally {
      setLoading(false);
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
          onChange={(e) => setCep(maskCep(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && calc()}
          aria-label="CEP de entrega"
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-body"
        />
        <button onClick={calc} disabled={loading} className="shrink-0 rounded-full border border-foreground bg-background px-5 text-body font-medium text-foreground disabled:opacity-60">
          {loading ? "..." : "Calcular"}
        </button>
      </div>
      {err && <p className="mt-2 text-body text-destructive">{err}</p>}
      {dest && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-body">
          <p className="text-muted-foreground">Entrega para {dest.city}/{dest.uf}</p>
          {hasFreeShipping(subtotal) && <p className="mt-1 font-medium">Frete Grátis — pedido acima de {brl(FREE_SHIPPING_ABOVE)} em produtos (vale mesmo após o desconto do Pix).</p>}
          <ul className="mt-2 space-y-1">
            {opts.map((o) => (
              <li key={o.id} className="flex justify-between gap-3">
                <span>{o.company} {o.name} <span className="text-muted-foreground">· até {o.days} dias úteis</span></span>
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
  const cart = useCart();
  const fav = useFavorites();
  const { audience } = useAudience();
  const nav = useNavigate();
  const [vi, setVi] = useState(0);
  const [qty, setQty] = useState(1);
  const v = p.variants[vi] ?? p.variants[0]!;
  const compare = vi === 0 ? p.compareBase : null;
  const off = discountPct(compare, v.price);
  const related = forAudience(products.filter((x) => x.category === p.category && x.slug !== p.slug), audience).slice(0, 4);
  const sel = lineTotals(v.price, qty);
  const discounted = sel.net < sel.gross;
  const unitPrice = sel.net / sel.units;
  useEffect(() => {
    track("view_item", { value: v.price, items: [toItem(p, v.label, v.price)] });
  }, [p.slug]);
  const add = () => {
    cart.add(p.slug, v.label, qty);
    track("add_to_cart", { value: unitPrice * sel.units, items: [toItem(p, v.label, unitPrice, sel.units)] });
  };
  const total = sel.net;
  return (
    <Shell>
      <div className="container-site py-8 pb-28 lg:pb-8">
        <nav className="mb-6 text-small text-muted-foreground">
          <Link to="/">Início</Link> / <Link to="/loja" search={{ categoria: p.category }}>{p.categoryLabel}</Link> / {p.name}
        </nav>
        <div className="grid gap-10 lg:grid-cols-2">
          <ProductGallery key={p.slug} images={p.images} name={p.name} />
          <div className="min-w-0">
            {off > 0 && <span className="rounded-full bg-foreground px-3 py-1 text-small text-background">{off}% OFF</span>}
            <h1 className="mt-3 font-display text-h1">{p.name}</h1>
            <Stars slug={p.slug} />
            <div className="mt-3"><ShareButton compact url={`${SITE_URL}/produto/${p.slug}`} title={`${p.name} — Vonix Hair`} text={`Olha esse produto da Vonix Hair: ${p.name}.`} label="Compartilhar" /></div>
            {p.short && <p className="mt-3 text-muted-foreground">{p.short}</p>}
            {(
              <div className="mt-6">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div className="font-display text-h2 leading-tight">{audience === "salao" ? "Promoção para cabeleireiras" : "Compre mais e economize"}</div>
                  <div className="text-small text-muted-foreground">mesmo produto, mesmo tamanho</div>
                </div>
                <div role="radiogroup" aria-label="Quantidade em promoção" className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
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
                        onClick={() => setQty(o.n)}
                        className={`relative flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all sm:flex-col sm:items-start sm:gap-1.5 sm:p-4 ${on ? "border-[#c9992f] bg-[#fff8e8] shadow-[0_6px_18px_-8px_rgba(201,153,47,0.6)]" : "border-border bg-white hover:border-[#c9992f]/60"}`}
                      >
                        {best && (
                          <span className="absolute -top-2.5 right-3 rounded-full bg-[#7a5a2e] px-2.5 py-0.5 text-small font-semibold text-white">Melhor preço</span>
                        )}
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? "border-[#c9992f] bg-[#c9992f] text-white" : "border-border bg-white text-transparent"}`} aria-hidden="true">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1 sm:w-full">
                          <span className="block text-body font-semibold leading-tight">{o.label}</span>
                          <span className="mt-0.5 block text-small text-muted-foreground">{pct ? `${pct}% de desconto` : "Preço normal"}</span>
                        </span>
                        <span className="text-right sm:w-full sm:text-left">
                          <span className="money block text-h2 font-semibold leading-tight">{brl(t.net)}</span>
                          {pct > 0 ? (
                            <span className="mt-1 inline-flex rounded-full bg-[#eef8f2] px-2 py-0.5 text-small font-medium text-[#2c6e55]">Economize {brl(t.gross - t.net)}</span>
                          ) : (
                            <span className="mt-1 block text-small text-muted-foreground">{brl(v.price)} cada</span>
                          )}
                          {pct > 0 && <span className="mt-0.5 block text-small text-muted-foreground">{brl(t.net / t.units)} cada</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-2xl bg-[#faf6ee] px-4 py-3.5">
                  <div>
                    <div className="text-small text-muted-foreground">Seu pedido · {sel.units} {sel.units === 1 ? "unidade" : "unidades"}{discounted ? ` · ${volumePct(qty)}% OFF` : ""}</div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {discounted ? (
                        <span className="money text-muted-foreground line-through">{brl(sel.gross)}</span>
                      ) : compare && compare > v.price ? (
                        <span className="money text-muted-foreground line-through">{brl(compare * sel.units)}</span>
                      ) : null}
                      <span className="money text-h2 font-semibold leading-tight">{brl(sel.net)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    {discounted ? (
                      <span className="money rounded-full bg-[#eef8f2] px-3 py-1 text-body font-semibold text-[#2c6e55]">Você economiza {brl(sel.gross - sel.net)}</span>
                    ) : (
                      <span className="money inline-flex items-center gap-1.5 rounded-full bg-[#eef8f2] px-3 py-1 text-body font-medium text-[#2c6e55]"><PixMark className="h-4 w-4" /> {brl(pixPrice(sel.net))} no Pix</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {p.variants.length > 1 && (
              <div className="mt-6">
                <div className="mb-2 text-body font-medium">Tamanho</div>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map((x, k) => (
                    <button key={x.label} onClick={() => setVi(k)} className={`rounded-full border px-4 py-2 text-body ${k === vi ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                      {x.label} · {brl(x.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {p.variants.length === 1 && <div className="mt-4 text-body text-muted-foreground">Tamanho: {v.label}</div>}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-border">
                <button aria-label="Diminuir" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center" data-testid="qty">{qty}</span>
                <button aria-label="Aumentar" className="p-3" onClick={() => setQty((q) => Math.min(99, q + 1))}><Plus className="h-4 w-4" /></button>
              </div>
              <span className="text-small text-muted-foreground">unidade(s)</span>
              <button aria-label="Favoritar" onClick={() => fav.toggle(p.slug)} className="rounded-full border border-border p-3">
                <Heart className={`h-4 w-4 ${fav.has(p.slug) ? "fill-foreground" : ""}`} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button className="rounded-full bg-action py-3.5 font-medium text-action-foreground" onClick={() => { add(); nav({ to: "/carrinho" }); }}>
                Comprar agora
              </button>
              <button className="rounded-full border border-foreground py-3.5 font-medium" onClick={() => { add(); toast.success("Adicionado ao carrinho"); }}>
                Adicionar ao carrinho
              </button>
            </div>
            <div className="mt-4"><PaymentMethods /></div>
            <div className="mt-3"><SecuritySeal /></div>
            <ShippingCalc subtotal={total} slug={p.slug} variant={v.label} qty={qty} />
            <ul className="mt-4 space-y-1 text-body text-muted-foreground">
              <li>Frete grátis em compras acima de {brl(FREE_SHIPPING_ABOVE)} em produtos, antes dos descontos</li>
              <li><a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">Dúvidas? Fale com a gente no WhatsApp</a></li>
            </ul>
          </div>
        </div>
        {p.description && <ProductDetails p={p} />}
        <ProductReviews slug={p.slug} />
        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 [&_em]:not-italic">Você também pode <em>gostar</em></h2>
            <Grid carousel items={related} />
          </section>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-background p-3 lg:hidden">
        <div className="min-w-0 leading-tight">
          <div className="truncate text-small text-muted-foreground">{p.name}</div>
          <div className="font-semibold">{brl(total)}</div>
          {!discounted && <div className="money text-small font-semibold text-[#2c6e55]">{brl(pixPrice(total))} no Pix</div>}
        </div>
        <button className="ml-auto shrink-0 rounded-full bg-action px-6 py-3 text-body font-medium text-action-foreground" onClick={() => { add(); nav({ to: "/carrinho" }); }}>
          Comprar agora
        </button>
      </div>
    </Shell>
  );
}
