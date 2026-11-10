import { Check, Lock, Minus, Plus, Trash2, Truck } from "lucide-react";
import { toItem, track } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { pickExtras } from "@/lib/upsell";
import {
  FREE_SHIPPING_ABOVE,
  brl,
  missingForFreeShipping,
  useCart,
  type Product,
} from "@/lib/store";

/**
 * Gaveta que abre ao clicar em "Comprar agora": confirma o item, mostra quanto falta para o frete grátis,
 * sugere poucos produtos para levar junto e manda direto para o pagamento.
 */
export function BuyDrawer({ onClose, onPay }: { onClose: () => void; onPay: () => void }) {
  const cart = useCart();
  const inCart = new Set(cart.lines.map((l) => l.slug));
  // Sorteado uma vez a cada abertura (não muda enquanto a pessoa adiciona itens).
  const [extras] = useState<Product[]>(() => pickExtras(cart.lines.map((l) => l.slug)));
  // Shipping eligibility uses the product gross subtotal, not post-promotion totals.
  // Eligibility still does not prove the address has a valid carrier quote.
  const missing = missingForFreeShipping(cart.subtotal);
  const pct = Math.min(100, Math.round((cart.subtotal / FREE_SHIPPING_ABOVE) * 100));
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]") ?? [],
      );
      if (!controls.length) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const addExtra = (p: Product) => {
    const v = p.variants[0]!;
    cart.add(p.slug, v.label, 1);
    track("add_to_cart", { value: v.price, items: [toItem(p, v.label, v.price, 1)] });
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex justify-end bg-black/50 backdrop-blur-[2px]"
      style={{ animation: "vx-fade .25s ease-out" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Item adicionado"
    >
      <style>
        {
          "@keyframes vx-fade{from{opacity:0}to{opacity:1}}@keyframes vx-slide{from{transform:translateX(100%)}to{transform:none}}"
        }
      </style>
      <div
        ref={panel}
        className="flex h-full w-full max-w-[420px] flex-col bg-background shadow-2xl"
        style={{ animation: "vx-slide .32s cubic-bezier(.22,1,.36,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <b className="flex items-center gap-2 text-name text-emerald-700">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="h-4 w-4" />
            </span>
            Adicionado ao carrinho
          </b>
          <button
            ref={closeButton}
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-muted text-xl leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {cart.lines.length === 0 && (
            <p className="py-4 text-center text-body text-muted-foreground">
              Seu carrinho está vazio.
            </p>
          )}
          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li
                key={l.slug + l.variant + (l.offer ?? "")}
                className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 text-body"
              >
                <img
                  src={l.product.images[0]}
                  alt={l.product.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-lg border border-border bg-white object-contain"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{l.product.name}</span>
                  <span className="text-small text-muted-foreground">{l.variant}</span>
                </span>
                <div className="col-span-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${l.product.name}, ${l.variant}`}
                    disabled={l.qty <= 1}
                    onClick={() => cart.setQty(l.slug, l.variant, l.qty - 1, l.offer)}
                    className="grid h-11 w-11 place-items-center rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center font-semibold" aria-live="polite">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${l.product.name}, ${l.variant}`}
                    disabled={l.qty >= 99}
                    onClick={() => cart.setQty(l.slug, l.variant, l.qty + 1, l.offer)}
                    className="grid h-11 w-11 place-items-center rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${l.product.name}, ${l.variant}`}
                    onClick={() => cart.remove(l.slug, l.variant, l.offer)}
                    className="ml-2 flex min-h-11 items-center gap-1 text-small text-red-600 underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remover
                  </button>
                </div>
                <b className="col-start-3 row-start-1 whitespace-nowrap">{brl(l.net)}</b>
              </li>
            ))}
          </ul>

          <div
            className={`rounded-xl border p-3 ${missing > 0 ? "border-border bg-white" : "border-emerald-300 bg-emerald-50"}`}
          >
            <div className="flex items-center gap-2 text-body font-semibold">
              <Truck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {missing > 0 ? (
                <>
                  Faltam <span className="text-emerald-700">{brl(missing)}</span> em produtos para
                  atingir o valor mínimo do frete grátis.
                </>
              ) : (
                <span className="text-emerald-800">
                  Você atingiu o valor mínimo em produtos para frete grátis.
                </span>
              )}
            </div>
            <p className="mt-1 text-small text-muted-foreground">
              Disponibilidade, valor e prazo sujeitos à cotação do CEP no checkout.
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Progresso para o valor mínimo do frete grátis"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {extras.length > 0 && (
            <div>
              <div className="mb-2 text-body font-bold">Aproveite e leve também</div>
              <ul className="space-y-2">
                {extras.map((p) => {
                  const v = p.variants[0]!;
                  return (
                    <li
                      key={p.slug}
                      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-white p-2"
                    >
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="h-14 w-14 rounded-lg object-contain"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-medium">{p.name}</span>
                        <b className="text-body">{brl(v.price)}</b>
                      </span>
                      {inCart.has(p.slug) ? (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-body font-bold text-white">
                          <Check className="h-4 w-4" aria-hidden="true" /> Adicionado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addExtra(p)}
                          aria-label={`Adicionar ${p.name} ao carrinho`}
                          className="flex min-h-11 items-center gap-1 rounded-md bg-emerald-50 px-3 py-2 text-body font-bold text-emerald-800 ring-1 ring-emerald-300 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-border bg-background p-4">
          <div className="flex justify-between text-body">
            <span className="text-muted-foreground">Subtotal</span>
            <b>{brl(cart.netSubtotal)}</b>
          </div>
          <button
            type="button"
            onClick={onPay}
            disabled={cart.lines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-4 text-name font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:shadow-none"
          >
            <Lock className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" /> Ir para o pagamento
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-body underline">
            Continuar comprando
          </button>
        </div>
      </div>
    </div>
  );
}
