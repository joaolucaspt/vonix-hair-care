import { FREE_SHIPPING_ABOVE, brl, checkoutTotals, hasFreeShipping, installments, missingForFreeShipping, type Offer } from "@/lib/store";

export function ShippingBar({ subtotal }: { subtotal: number }) {
  const free = hasFreeShipping(subtotal);
  const pct = Math.min(100, (subtotal / (FREE_SHIPPING_ABOVE + 0.01)) * 100);
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-body">
      {free ? <b>Você ganhou frete grátis! 🎉</b> : <>Faltam <b>{brl(missingForFreeShipping(subtotal))}</b> em produtos para ganhar frete grátis.</>}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-action transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-small text-muted-foreground">
        Frete grátis acima de {brl(FREE_SHIPPING_ABOVE)} em produtos, antes dos descontos. Seu cupom e o desconto no Pix mantêm esse benefício.
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
      <div className="flex justify-between"><span>Frete</span><span>{t.freeShipping ? "Grátis" : "Calculado pelo CEP no checkout"}</span></div>
      <div className="flex justify-between border-t border-border pt-2 text-body font-semibold"><span>Total no Pix (5% off*)</span><span>{brl(tPix.net)}</span></div>
      <div className="flex justify-between"><span>Total no cartão{t.freeShipping ? "" : " (sem frete)"}</span><span>{brl(t.net)}</span></div>
      <div className="text-muted-foreground">ou até 6x de {brl(i.value)} sem juros{i.first !== i.value ? ` (1ª de ${brl(i.first)})` : ""}</div>
      {t.hasOffers && (
        <p className="text-small text-muted-foreground">*Ofertas não cumulativas no mesmo item: o desconto do Pix vale apenas para itens sem outra oferta.</p>
      )}
    </div>
  );
}
