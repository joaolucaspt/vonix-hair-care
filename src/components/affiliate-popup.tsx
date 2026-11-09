import { Link, useLocation } from "@tanstack/react-router";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getRef } from "@/lib/affiliate-ref";
import { lookupCoupon } from "@/lib/checkout.functions";
import { track } from "@/lib/analytics";

const seenKey = (ref: string) => `vonix-afiliada-aviso-${ref}`;

/**
 * Quem entra pelo link de uma afiliada (?ref=isabela) vê, igual à roleta, que ganhou 10% de desconto pelo link dela.
 * Só aparece se o app de afiliadas confirmar que o cupom (ISABELA10) existe; o desconto entra sozinho no checkout.
 */
export function AffiliatePopup() {
  const path = useLocation().pathname;
  const hidden = path === "/carrinho" || path === "/checkout" || path === "/conta" || path === "/auth";
  const [info, setInfo] = useState<{ code: string; percent: number; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ref = getRef();
    if (!ref || info) return;
    try {
      if (localStorage.getItem(seenKey(ref)) === "1") return;
    } catch {
      /* sem armazenamento: mostra mesmo assim */
    }
    let alive = true;
    lookupCoupon({ data: { code: `${ref.toUpperCase()}10` } })
      .then((r) => {
        if (!alive || !r.ok) return;
        const name = /\(cupom da (.+)\)$/.exec(r.label)?.[1] ?? "";
        setInfo({ code: r.code, percent: r.percent, name });
        setTimeout(() => alive && setOpen(true), 800);
        track("affiliate_popup", { coupon: r.code });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [info]);

  const close = () => {
    setOpen(false);
    const ref = getRef();
    if (ref) {
      try {
        localStorage.setItem(seenKey(ref), "1");
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden || !open || !info) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Desconto da afiliada" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={close}>
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 rounded-full p-1.5 text-[#c72c8e]">
          <X className="h-5 w-5" />
        </button>
        <p className="text-body text-muted-foreground">Parabéns! Você ganhou</p>
        <p className="mt-1 font-display text-[3rem] font-semibold leading-none text-[#5a0e4d]">{info.percent}% OFF</p>
        <p className="mt-2 text-body">
          {info.name ? <>pelo link da <b>{info.name}</b></> : "pelo link da sua indicação"} · em qualquer compra
        </p>
        <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border-2 border-dashed border-[#c9992f] bg-[#fdf8f4] px-4 py-2">
          <b className="text-price tracking-widest tabular-nums">{info.code}</b>
          <button
            type="button"
            aria-label="Copiar cupom"
            onClick={() => navigator.clipboard?.writeText(info.code).then(() => setCopied(true)).catch(() => undefined)}
            className="rounded p-1.5 text-[#5a0e4d]"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-3 text-small text-muted-foreground">O desconto é aplicado automaticamente no checkout. Soma com o desconto do Pix.</p>
        <Link to="/loja" onClick={close} className="mt-4 block rounded-lg bg-[#5a0e4d] py-3 font-semibold text-white">
          Aproveitar agora
        </Link>
      </div>
    </div>
  );
}
