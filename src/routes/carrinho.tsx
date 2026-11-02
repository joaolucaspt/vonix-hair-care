import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Shell } from "@/components/site";
import { OFFER_LABEL, brl, complementsFor, pixPrice, useCart, useHydrated } from "@/lib/store";
import { ShippingBar, Summary } from "@/components/cart-summary";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Vonix Hair" },
      { name: "description", content: "Seu carrinho Vonix Hair." },
      { property: "og:title", content: "Carrinho — Vonix Hair" },
      { property: "og:description", content: "Seu carrinho Vonix Hair." },
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
            <div key={p.slug} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 text-body">
              <Link to="/produto/$slug" params={{ slug: p.slug }} className="block">
                <img src={p.images[0]} alt="" className="h-24 w-full rounded-lg bg-card-image object-contain" />
              </Link>
              <Link to="/produto/$slug" params={{ slug: p.slug }} className="mt-2 font-medium hover:underline">
                {p.name}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-small text-muted-foreground">{p.short}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-small text-muted-foreground line-through">{brl(v.price)}</span>
                <b>{brl(offer)}</b>
              </div>
              <div className="text-small text-muted-foreground">Economia de {brl(v.price - offer)} neste item</div>
              <button
                onClick={() => c.add(p.slug, v.label, 1, "comp5")}
                className="mt-3 rounded-full border border-action px-4 py-2 text-small font-medium text-action"
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
  return (
    <Shell>
      <div className="container-site py-10 pb-28 lg:pb-10">
        <h1 className="mb-8 font-display text-h1">Carrinho</h1>
        {!hydrated ? (
          <div className="min-h-[40vh]" aria-busy="true" />
        ) : c.lines.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Link to="/loja" className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground">Ver produtos</Link>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <ul className="divide-y divide-border">
                {c.lines.map((l) => (
                  <li key={l.slug + l.variant + (l.offer ?? "")} className="flex gap-4 py-4">
                    <img src={l.product.images[0]} alt="" className="h-24 w-24 shrink-0 rounded-lg bg-card-image object-contain" />
                    <div className="min-w-0 flex-1">
                      <Link to="/produto/$slug" params={{ slug: l.slug }} className="font-medium">{l.product.name}</Link>
                      <div className="text-small text-muted-foreground">{l.variant} · {brl(l.price)}</div>
                      {l.offer && (
                        <div className="mt-1 inline-block rounded-full bg-foreground px-2.5 py-0.5 text-small font-medium text-background">
                          {OFFER_LABEL[l.offer]}{(l.offer === "kit2" || l.offer === "kit3") ? ` · ${l.units} un. no total` : ""}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button aria-label="Diminuir" onClick={() => c.setQty(l.slug, l.variant, l.qty - 1, l.offer)} className="rounded-full border border-border p-1.5"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center">{l.qty}</span>
                        <button aria-label="Aumentar" onClick={() => c.setQty(l.slug, l.variant, l.qty + 1, l.offer)} className="rounded-full border border-border p-1.5"><Plus className="h-3 w-3" /></button>
                        <button aria-label="Remover" onClick={() => c.remove(l.slug, l.variant, l.offer)} className="ml-3 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {l.offer && <div className="text-small text-muted-foreground line-through">{brl(l.gross)}</div>}
                      <div className="font-semibold">{brl(l.net)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <Suggestions />
            </div>
            <aside className="space-y-4">
              <ShippingBar subtotal={c.subtotal} />
              <Summary lines={c.lines} />
              <Link to="/checkout" className="hidden rounded-full bg-action py-3.5 text-center font-medium text-action-foreground lg:block">Finalizar minha compra</Link>
              <Link to="/loja" className="block text-center text-body underline">Continuar comprando</Link>
            </aside>
          </div>
        )}
      </div>
      {c.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-3 lg:hidden">
          <Link to="/checkout" className="block rounded-full bg-action py-3.5 text-center font-medium text-action-foreground">
            Finalizar minha compra
          </Link>
        </div>
      )}
    </Shell>
  );
}
