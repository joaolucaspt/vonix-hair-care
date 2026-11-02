import { Link, useLocation } from "@tanstack/react-router";
import { Check, Copy, Gift, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WHEEL, findCoupon, getPrize, prizeDays, savePrize, type Coupon } from "@/lib/coupons";
import { track } from "@/lib/analytics";

const COLORS = ["#5a0e4d", "#c72c8e", "#c9992f", "#3b2a18"];
const SEEN = "vonix-roleta-fechada";

/** Point on the wheel (angle in degrees, clockwise from the top). */
const pt = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
};
const arc = (from: number, to: number) => {
  const [x1, y1] = pt(from, 96);
  const [x2, y2] = pt(to, 96);
  return `M0 0 L${x1} ${y1} A96 96 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
};

/** Random number in [0,1) from the browser's crypto source. */
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

type Phase = "ready" | "spinning" | "won";

export function PrizeWheel() {
  const path = useLocation().pathname;
  const hidden = path === "/carrinho" || path === "/checkout" || path === "/conta" || path === "/auth";
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [accepted, setAccepted] = useState(false);
  const [deg, setDeg] = useState(0);
  const [prize, setPrize] = useState<Coupon | null>(null);
  const [had, setHad] = useState(false);
  const [copied, setCopied] = useState(false);
  const target = useRef<Coupon | null>(null);

  const segments = useMemo(() => {
    let acc = 0;
    return WHEEL.map((w, i) => {
      const c = findCoupon(w.code)!;
      const from = acc;
      acc += (w.weight / 100) * 360;
      return { c, from, to: acc, mid: (from + acc) / 2, color: COLORS[i % COLORS.length]! };
    });
  }, []);

  useEffect(() => {
    const existing = getPrize();
    setHad(!!existing);
    if (existing) setPrize(existing);
    if (existing || hidden) return;
    let closed = false;
    try {
      closed = sessionStorage.getItem(SEEN) === "1";
    } catch {
      /* ignore */
    }
    if (closed) return;
    const t = setTimeout(() => setOpen(true), 8000);
    return () => clearTimeout(t);
  }, [hidden]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close]);

  const spin = () => {
    if (!accepted || phase !== "ready") return;
    // Weighted draw: arc size on the wheel is exactly the chance of winning that coupon.
    let r = rand() * 100;
    let pick = segments[segments.length - 1]!;
    for (const s of segments) {
      if (r < (s.to - s.from) / 3.6) {
        pick = s;
        break;
      }
      r -= (s.to - s.from) / 3.6;
    }
    target.current = pick.c;
    const jitter = (rand() - 0.5) * (pick.to - pick.from) * 0.6;
    setPhase("spinning");
    setDeg(360 * 6 - pick.mid - jitter);
    track("spin_wheel", { coupon: pick.c.code });
  };

  const onEnd = () => {
    if (phase !== "spinning" || !target.current) return;
    savePrize(target.current.code);
    setPrize(target.current);
    setHad(true);
    setPhase("won");
  };

  const copy = () => {
    if (!prize) return;
    navigator.clipboard?.writeText(prize.code).then(() => setCopied(true)).catch(() => undefined);
  };

  if (hidden) return null;
  return (
    <>
      {!open && !had && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-4 z-40 flex items-center gap-2 rounded-full bg-[#5a0e4d] px-4 py-3 text-body font-semibold text-white shadow-lg"
        >
          <Gift className="h-5 w-5" aria-hidden="true" /> Gire e ganhe
        </button>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Roleta de ofertas" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={close}>
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Fechar" onClick={close} className="absolute right-3 top-3 rounded-full p-1.5 text-[#c72c8e]">
              <X className="h-5 w-5" />
            </button>
            <h2 className="pr-8">Roleta de ofertas</h2>

            {phase !== "won" ? (
              <>
                <p className="mt-2 text-body text-muted-foreground">Gire a roleta e ganhe um cupom de desconto. <b>Todo giro ganha.</b></p>
                <div className="relative mx-auto mt-4 w-72 max-w-full">
                  <div aria-hidden="true" className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-[#c9992f]" />
                  <svg
                    viewBox="-100 -100 200 200"
                    role="img"
                    aria-label="Roleta com cupons de 3%, 4%, 5% e 6% de desconto"
                    className="w-full"
                    style={{ transform: `rotate(${deg}deg)`, transition: phase === "spinning" ? "transform 5s cubic-bezier(.17,.67,.12,.99)" : "none" }}
                    onTransitionEnd={onEnd}
                  >
                    {segments.map((s) => {
                      const [tx, ty] = pt(s.mid, 62);
                      return (
                        <g key={s.c.code}>
                          <path d={arc(s.from, s.to)} fill={s.color} stroke="#fff" strokeWidth="1.5" />
                          <g transform={`translate(${tx} ${ty}) rotate(${s.mid})`}>
                            <text textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800" y="-2">{s.c.percent}% OFF</text>
                            <text textAnchor="middle" fill="#fff" fontSize="6.5" y="9">{s.c.minSubtotal ? `acima de R$ ${s.c.minSubtotal}` : "em qualquer compra"}</text>
                          </g>
                        </g>
                      );
                    })}
                    <circle r="14" fill="#fff" stroke="#c9992f" strokeWidth="2" />
                    <text textAnchor="middle" y="5" fontSize="13" fontWeight="800" fill="#c9992f">V</text>
                  </svg>
                </div>
                <button
                  type="button"
                  disabled={!accepted || phase === "spinning"}
                  onClick={spin}
                  className="mt-5 w-full rounded-lg bg-[#5a0e4d] py-3 font-semibold text-white disabled:bg-neutral-300 disabled:text-neutral-500"
                >
                  {phase === "spinning" ? "Girando…" : "Girar a roleta"}
                </button>
                {!accepted && <p className="mt-1.5 text-center text-small text-muted-foreground">Aceite os termos para poder girar.</p>}
                <label className="mt-3 flex items-start gap-2 text-small text-muted-foreground">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Ao girar, você aceita os termos da <Link to="/$page" params={{ page: "politica-de-privacidade" }} className="underline" onClick={close}>Política de Privacidade</Link>. Não pedimos nenhum dado seu para girar. 1 giro por visitante.
                  </span>
                </label>
              </>
            ) : (
              prize && (
                <div role="status" className="mt-3 text-center">
                  <p className="text-body text-muted-foreground">Você ganhou</p>
                  <p className="mt-1 text-h1 font-semibold text-[#5a0e4d]">{prize.percent}% OFF</p>
                  <p className="mt-1 text-body">{prize.label}</p>
                  <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-lg border-2 border-dashed border-[#c9992f] bg-[#fdf8f4] px-4 py-2">
                    <b className="text-price tracking-widest tabular-nums">{prize.code}</b>
                    <button type="button" onClick={copy} aria-label="Copiar cupom" className="rounded p-1.5 text-[#5a0e4d]">
                      {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="mt-3 text-small text-muted-foreground">
                    Aplicado automaticamente no checkout, por {prizeDays} dias neste aparelho. Vale para itens sem outra oferta; não soma com o Leve 2 / Leve 3. Soma com o desconto do Pix.
                  </p>
                  <Link to="/loja" onClick={close} className="mt-4 block rounded-lg bg-[#5a0e4d] py-3 font-semibold text-white">Ver produtos</Link>
                </div>
              )
            )}
          </div>
        </div>
      )}
      {had && !open && prize && (
        <button type="button" onClick={() => { setPhase("won"); setOpen(true); }} className="fixed bottom-5 left-4 z-40 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-small font-semibold text-[#5a0e4d] shadow-lg ring-1 ring-[#c9992f]">
          <Gift className="h-4 w-4" aria-hidden="true" /> Cupom {prize.code}
        </button>
      )}
    </>
  );
}
