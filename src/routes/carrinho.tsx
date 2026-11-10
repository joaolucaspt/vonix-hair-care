import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toItem, track } from "@/lib/analytics";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Shell } from "@/components/site";
import {
  CART_REVALIDATED_KEY,
  OFFER_LABEL,
  brl,
  complementsFor,
  pixPrice,
  useCart,
  useHydrated,
} from "@/lib/store";
import { ShippingBar, Summary } from "@/components/cart-summary";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Vonix Hair" },
      { name: "description", content: "Seu carrinho Vonix Hair." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Carrinho — Vonix Hair" },
      { property: "og:description", content: "Seu carrinho Vonix Hair." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cart,
});

/** Até 3 complementos contextuais, sempre visíveis, com 5% OFF no próprio item. */
function Suggestions() {
  const c = useCart();
  const items = complementsFor(c.lines.map((l) => l.slug));
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-label="Complete seu tratamento">
      <h2 className="font-display text-h2">Complete seu tratamento</h2>
      <p className="mt-1 text-body text-muted-foreground">
        Escolha o cuidado que falta na sua rotina e aproveite a condição deste item.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((p) => {
          const v = p.variants[0];
          const offer = pixPrice(v.price);
          return (
            <div
              key={p.slug}
              className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 text-body"
            >
              <Link to="/produto/$slug" params={{ slug: p.slug }} className="block">
                <img
                  src={p.images[0]}
                  alt=""
                  className="h-24 w-full rounded-lg bg-card-image object-contain"
                />
              </Link>
              <Link
                to="/produto/$slug"
                params={{ slug: p.slug }}
                className="mt-2 font-medium hover:underline"
              >
                {p.name}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-small text-muted-foreground">{p.short}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-small text-muted-foreground line-through">
                  {brl(v.price)}
                </span>
                <b>{brl(offer)}</b>
              </div>
              <div className="text-small text-muted-foreground">
                Economia de {brl(v.price - offer)} neste item
              </div>
              <button
                onClick={() => {
                  c.add(p.slug, v.label, 1, "comp5");
                  track("add_to_cart", { value: offer, items: [toItem(p, v.label, offer)] });
                }}
                type="button"
                aria-label={`Adicionar ${p.name} à sacola`}
                className="mt-3 min-h-11 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-small font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Adicionar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Cart() {
  const c = useCart();
  const hydrated = useHydrated();
  const seen = useRef("");
  const [cartAdjusted, setCartAdjusted] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sessionStorage.getItem(CART_REVALIDATED_KEY) === "1") {
        sessionStorage.removeItem(CART_REVALIDATED_KEY);
        setCartAdjusted(true);
      }
    } catch {
      // In private mode the cart stays usable without an adjustment notice.
    }
  }, [hydrated, c.lines]);
  useEffect(() => {
    if (!hydrated || !c.lines.length) return;
    const items = c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units));
    const key = JSON.stringify(items);
    if (seen.current === key) return;
    seen.current = key;
    track("view_cart", { value: c.netSubtotal, items });
  }, [hydrated, c.lines, c.netSubtotal]);
  return (
    <Shell>
      <div className="container-site py-10 pb-28 lg:pb-10">
        <h1 className="mb-8 font-display text-h1">Carrinho</h1>
        {hydrated && cartAdjusted && (
          <div
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-body text-amber-950"
            role="status"
          >
            <p>
              Atualizamos sua sacola conforme os produtos e ofertas disponíveis. Itens indisponíveis
              são removidos e ofertas sem elegibilidade são recalculadas, quando aplicável. Confira
              os valores antes de finalizar.
            </p>
            <button
              type="button"
              aria-label="Dispensar aviso do carrinho"
              className="shrink-0 rounded-md border border-amber-500 px-3 py-1 text-small font-semibold"
              onClick={() => setCartAdjusted(false)}
            >
              Fechar
            </button>
          </div>
        )}
        {!hydrated ? (
          <div className="min-h-[40vh]" aria-busy="true">
            <noscript>
              <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center">
                <h2 className="font-display text-h2">Sua sacola depende do navegador</h2>
                <p className="mt-3 text-body">
                  Ative o JavaScript para conferir sua sacola, ajustar quantidades e finalizar a
                  compra.
                </p>
                <a
                  href="/loja"
                  className="mt-5 inline-flex min-h-11 items-center rounded-full bg-emerald-600 px-6 font-semibold text-white"
                >
                  Voltar à loja
                </a>
              </section>
            </noscript>
          </div>
        ) : c.lines.length === 0 ? (
          <section
            aria-label="Sua sacola"
            className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:py-16"
          >
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ShoppingBag aria-hidden="true" className="h-8 w-8" strokeWidth={1.7} />
            </span>
            <h2 className="font-display text-h2">Sua sacola está vazia</h2>
            <p className="mt-3 max-w-md text-body text-muted-foreground">
              Explore os tratamentos Vonix Hair e escolha os produtos para sua rotina. Os valores e
              a entrega serão conferidos antes do pagamento.
            </p>
            <div className="mt-7 flex w-full flex-wrap justify-center gap-3">
              <Link
                to="/loja"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-body font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Explorar produtos
              </Link>
              <Link
                to="/loja"
                search={{ tiposProduto: "Kits" }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-body font-semibold transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Explorar kits
              </Link>
            </div>
          </section>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <ul className="divide-y divide-border">
                {c.lines.map((l) => (
                  <li key={l.slug + l.variant + (l.offer ?? "")} className="flex gap-4 py-4">
                    <img
                      src={l.product.images[0]}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-lg bg-card-image object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <Link to="/produto/$slug" params={{ slug: l.slug }} className="font-medium">
                        {l.product.name}
                      </Link>
                      <div className="text-small text-muted-foreground">
                        {l.variant} · {brl(l.price)}
                      </div>
                      {l.offer ? (
                        <div className="mt-1 inline-block rounded-full bg-foreground px-2.5 py-0.5 text-small font-medium text-background">
                          {OFFER_LABEL[l.offer]}
                          {l.offer === "kit2" || l.offer === "kit3"
                            ? ` · ${l.units} un. no total`
                            : ""}
                        </div>
                      ) : l.pct > 0 ? (
                        <div className="mt-1 inline-block rounded-full bg-[#eef8f2] px-2.5 py-0.5 text-small font-medium text-[#2c6e55]">
                          {l.pct}% OFF por levar {l.qty} unidades
                        </div>
                      ) : (
                        <div className="mt-1 text-small text-[#2c6e55]">
                          Leve 2 e ganhe 12% OFF · leve 3 ou mais e ganhe 15% OFF
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${l.product.name}, ${l.variant}${l.offer ? `, ${OFFER_LABEL[l.offer]}` : ""}`}
                          onClick={() => c.setQty(l.slug, l.variant, l.qty - 1, l.offer)}
                          disabled={l.qty <= 1}
                          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center" aria-live="polite">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${l.product.name}, ${l.variant}${l.offer ? `, ${OFFER_LABEL[l.offer]}` : ""}`}
                          onClick={() => c.setQty(l.slug, l.variant, l.qty + 1, l.offer)}
                          disabled={l.qty >= 99}
                          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${l.product.name}, ${l.variant}${l.offer ? `, ${OFFER_LABEL[l.offer]}` : ""}`}
                          onClick={() => c.remove(l.slug, l.variant, l.offer)}
                          className="grid min-h-11 min-w-11 place-items-center rounded-full text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {l.net < l.gross && (
                        <div className="money text-small text-muted-foreground line-through">
                          {brl(l.gross)}
                        </div>
                      )}
                      <div className="money font-semibold">{brl(l.net)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <Suggestions />
            </div>
            <aside className="space-y-4">
              <ShippingBar subtotal={c.subtotal} />
              <Summary lines={c.lines} />
              <Link
                to="/checkout"
                className="hidden rounded-md bg-emerald-600 font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] py-3.5 text-center lg:block"
              >
                Finalizar minha compra
              </Link>
              <Link to="/loja" className="block text-center text-body underline">
                Continuar comprando
              </Link>
            </aside>
          </div>
        )}
      </div>
      {hydrated && c.lines.length > 0 && (
        <div
          role="region"
          aria-label="Resumo do carrinho no celular"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-3 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.3)] lg:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 shrink-0" aria-live="polite">
              <span className="block text-small text-muted-foreground">Produtos, sem frete</span>
              <strong className="money block text-name">{brl(c.netSubtotal)}</strong>
            </div>
            <Link
              to="/checkout"
              className="ml-auto flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md bg-emerald-600 px-3 py-3 text-center text-body font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Finalizar minha compra
            </Link>
          </div>
        </div>
      )}
    </Shell>
  );
}
