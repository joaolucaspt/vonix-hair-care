import { Check, Truck } from "lucide-react";
import { FREE_SHIPPING_ABOVE, brl, checkoutTotals, hasFreeShipping, installments, missingForFreeShipping, type Offer } from "@/lib/store";

export function ShippingBar({ subtotal }: { subtotal: number }) {
  const free = hasFreeShipping(subtotal);
  const pct = Math.min(100, (subtotal / (FREE_SHIPPING_ABOVE + 0.01)) * 100);
  return (
    <div
      className={`rounded-2xl border-2 p-4 text-body shadow-sm ${free ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white" : "border-border bg-white"}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${free ? "bg-emerald-600 text-white shadow-[0_8px_18px_-8px_rgba(5,150,105,0.9)]" : "bg-emerald-100 text-emerald-700"}`}
          aria-hidden="true"
        >
          {free ? <Check className="h-6 w-6" strokeWidth={3} /> : <Truck className="h-5 w-5" strokeWidth={2} />}
        </span>
        <div className="min-w-0 leading-snug">
          {free ? (
            <>
              <b className="block text-name text-emerald-800">Seu pedido atingiu o valor para frete grátis</b>
              <span className="text-small text-emerald-900/80">Informe o CEP no checkout para confirmar disponibilidade e prazo.</span>
            </>
          ) : (
            <span>
              Faltam <b className="text-emerald-700">{brl(missingForFreeShipping(subtotal))}</b> para alcançar o valor mínimo para frete grátis.
            </span>
          )}
        </div>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Progresso para o frete grátis"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2.5 text-small text-muted-foreground">
        Condição para pedidos acima de {brl(FREE_SHIPPING_ABOVE)} em produtos, antes dos descontos. Sujeita à cotação de uma transportadora para o CEP informado.
      </p>
    </div>
  );
}

export function Summary({ lines }: { lines: { gross: number; net: number; offer?: Offer | undefined }[] }) {
  const t = checkoutTotals(lines, "card");
  const tPix = checkoutTotals(lines, "pix");
  const i = installments(t.net);
  return (
    <div className="space-y-2 text-body">
      <div className="flex justify-between"><span>Subtotal dos produtos</span><span>{brl(t.gross)}</span></div>
      {t.offerDiscount > 0 && <div className="flex justify-between"><span>Economia das ofertas (5/12/15%)</span><span>− {brl(t.offerDiscount)}</span></div>}
      <div className="flex justify-between"><span>Frete</span><span>{t.freeShipping ? "Elegível a grátis — confirmar CEP" : "Calculado pelo CEP no checkout"}</span></div>
      <div className="flex justify-between border-t border-border pt-2 text-body font-semibold"><span>Produtos no Pix (sem frete, até 5% off*)</span><span>{brl(tPix.net)}</span></div>
      <div className="flex justify-between"><span>Produtos no cartão (sem frete)</span><span>{brl(t.net)}</span></div>
      <div className="text-muted-foreground">ou até 6x de {brl(i.value)} sem juros{i.first !== i.value ? ` (1ª de ${brl(i.first)})` : ""}</div>
      {t.hasOffers && (
        <p className="text-small text-muted-foreground">*Ofertas não cumulativas no mesmo item: o desconto do Pix vale apenas para itens sem outra oferta.</p>
      )}
    </div>
  );
}
