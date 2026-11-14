import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toItem, track } from "@/lib/analytics";
import { Minus, Plus, Trash2, Truck } from "lucide-react";
import { Shell } from "@/components/site";
import {
  OFFER_LABEL,
  brl,
  complementPrice,
  complementsFor,
  getSavedCep,
  maskCep,
  saveCep,
  shippingText,
  useCart,
  useHydrated,
} from "@/lib/store";
import { quoteShipping } from "@/lib/checkout.functions";
import { ShippingBar, Summary } from "@/components/cart-summary";
import { ProvasEmVideo } from "@/components/provas-em-video";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Vonix Hair" },
      { name: "description", content: "Seu carrinho Vonix Hair." },
      { property: "og:title", content: "Carrinho — Vonix Hair" },
      { property: "og:description", content: "Seu carrinho Vonix Hair." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cart,
});

/** Até 3 complementos contextuais, sempre visíveis, com 5% OFF no próprio item. */
type CartOpt = { id: number; name: string; company: string; price: number; days: number; free: boolean };

/** Frete estimado já no carrinho: o cliente vê o valor ANTES do checkout (sem cobrança surpresa). Mostra o mais barato primeiro. */
function CartShipping({
  items,
}: {
  items: { slug: string; variant: string; qty: number; offer?: string }[];
}) {
  const quote = useServerFn(quoteShipping);
  const [cep, setCep] = useState("");
  const [opts, setOpts] = useState<CartOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const key = JSON.stringify(items);
  const run = async (value: string) => {
    const d = value.replace(/\D/g, "");
    const current = ++request.current;
    setOpts([]);
    setErr(null);
    if (d.length !== 8 || !items.length) return;
    saveCep(value);
    setLoading(true);
    try {
      const r = await quote({ data: { cep: d, items: items as never } });
      if (current !== request.current) return;
      if (r.ok) setOpts([...r.options].sort((a, b) => a.price - b.price || a.days - b.days));
      else setErr(r.message);
    } catch {
      if (current === request.current) setErr("Não foi possível calcular o frete agora.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setCep(saved);
  }, []);
  useEffect(() => {
    if (cep.replace(/\D/g, "").length === 8) void run(cep);
    // recalcula quando o carrinho muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="cart-shipping">
      <div className="flex items-center gap-2 text-body font-medium">
        <Truck className="h-4 w-4" strokeWidth={1.5} />
        Calcule o frete antes de finalizar
      </div>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="numeric"
          aria-label="CEP para calcular o frete"
          placeholder="00000-000"
          value={cep}
          onChange={(e) => {
            const v = maskCep(e.target.value);
            setCep(v);
            if (v.replace(/\D/g, "").length === 8) void run(v);
            else setOpts([]);
          }}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5"
        />
      </div>
      {loading && <p className="mt-2 text-small text-muted-foreground">Calculando…</p>}
      {err && <p className="mt-2 text-small text-red-700">{err}</p>}
      {opts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {opts.map((o, i) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-small"
            >
              <span>
                {o.free ? `${shippingText(o).title} · ${shippingText(o).eta}` : `${o.company} ${o.name} · ${o.days} dia${o.days === 1 ? "" : "s"} úteis`}
                {i === 0 && opts.length > 1 ? " · mais barato" : ""}
              </span>
              <span className="money font-semibold">{o.free ? "Grátis" : brl(o.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
          const offer = complementPrice(v.price);
          return (
            <div
              key={p.slug}
              className="relative flex min-w-0 cursor-pointer flex-col rounded-xl border border-border bg-card p-3 text-body"
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
                className="mt-2 font-medium after:absolute after:inset-0 after:z-[1] after:rounded-xl after:content-[''] hover:underline"
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
                onClick={() => c.add(p.slug, v.label, 1, "comp5")}
                className="relative z-10 mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-small font-semibold text-emerald-700 transition hover:bg-emerald-100"
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
      <div className="container-site py-5 pb-28 sm:py-10 lg:pb-10">
        <h1 className="mb-4 font-display text-h1 sm:mb-8">Carrinho</h1>
        {!hydrated ? (
          <div className="min-h-[40vh]" aria-busy="true" />
        ) : c.lines.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">Seu carrinho está vazio.</p>
            <Link
              to="/loja"
              className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
            >
              Ver produtos
            </Link>
          </div>
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
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          aria-label="Diminuir"
                          onClick={() => c.setQty(l.slug, l.variant, l.qty - 1, l.offer)}
                          className="rounded-full border border-border p-1.5"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center">{l.qty}</span>
                        <button
                          aria-label="Aumentar"
                          onClick={() => c.setQty(l.slug, l.variant, l.qty + 1, l.offer)}
                          className="rounded-full border border-border p-1.5"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          aria-label="Remover"
                          onClick={() => c.remove(l.slug, l.variant, l.offer)}
                          className="ml-3 text-muted-foreground"
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
              <section aria-label="Quem já usa Vonix" className="mt-6 rounded-2xl border border-border bg-card p-3">
                <p className="mb-2 text-small font-semibold">Quem já usa Vonix. Toque para assistir.</p>
                <ProvasEmVideo all seed="carrinho" max={8} />
              </section>
            </div>
            <aside className="space-y-4">
              <ShippingBar subtotal={c.subtotal} />
              <CartShipping
                items={c.lines.map((l) => ({
                  slug: l.slug,
                  variant: l.variant,
                  qty: l.qty,
                  ...(l.offer ? { offer: l.offer } : {}),
                }))}
              />
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
      {c.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-3 lg:hidden">
          <Link
            to="/checkout"
            className="block rounded-md bg-emerald-600 font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] py-3.5 text-center"
          >
            Finalizar minha compra
          </Link>
        </div>
      )}
    </Shell>
  );
}
