import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CreditCard, Lock, ShieldCheck, Truck } from "lucide-react";
import heroLogo from "@/assets/vonix-logo.webp";
import { SecuritySeal, Shell } from "@/components/site";
import { ShippingBar } from "@/components/cart-summary";
import { useCepAddress } from "@/hooks/use-cep-address";
import { toItem, track } from "@/lib/analytics";
import { isValidCpf } from "@/lib/cpf";
import { clearRef, getRef } from "@/lib/affiliate-ref";
import {
  createPayment,
  getOrderStatus,
  getPaymentConfig,
  lookupCoupon,
  quoteShipping,
} from "@/lib/checkout.functions";
import {
  FREE_SHIPPING_ABOVE,
  OFFER_LABEL,
  WHATSAPP,
  brl,
  checkoutTotals,
  getSavedCep,
  installments,
  maskCep,
  missingForFreeShipping,
  saveCep,
  shippingText,
  useCart,
  useHydrated,
} from "@/lib/store";
import { couponCheck, couponPercent, findCoupon, getPrize, isAffiliateCouponCode, type Coupon } from "@/lib/coupons";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Vonix Hair" },
      { name: "description", content: "Finalize sua compra Vonix Hair." },
      { property: "og:title", content: "Checkout — Vonix Hair" },
      { property: "og:description", content: "Finalize sua compra Vonix Hair." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const inp =
  "h-11 w-full rounded-lg border border-border bg-white px-3.5 text-body outline-none transition focus:border-action focus:ring-2 focus:ring-action/40";

const tint = "border-emerald-200 bg-emerald-50";

const panel =
  "space-y-2 rounded-2xl border border-border bg-white p-4 shadow-[0_6px_18px_-14px_rgba(60,40,10,0.35)] sm:p-5";

/** Selo dourado de cada forma de pagamento: marcado = borda e fundo dourados da marca. */
const payTile = (on: boolean) =>
  `relative flex min-w-0 cursor-pointer flex-col gap-1 rounded-xl border-2 p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action/60 ${
    on ? "border-[#c9a45c] bg-[#1b1209] text-white shadow-sm" : "border-border bg-white hover:border-[#c9a45c]/60"
  }`;

const StepTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <>
  <legend className="float-left mb-2 flex w-full items-center gap-2.5 font-display text-name" data-step={n}>
    {children}
  </legend>
  <div className="clear-both" />
  </>
);

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");

/** Apresentação apenas: o cálculo compartilhado mantém os centavos na primeira parcela. */
const installmentText = (total: number, count: number, interestFree = true) => {
  const split = installments(total, count);
  const firstDiffers = split.first !== split.value ? ` (1ª de ${brl(split.first)})` : "";
  return `${split.count}x de ${brl(split.value)}${interestFree ? " sem juros" : ""}${firstDiffers}`;
};

type ShipOption = {
  id: number;
  name: string;
  company: string;
  price: number;
  days: number;
  free: boolean;
};
type PixResult = { orderId: number; total: number; emv: string; qrcode: string; expiresAt: string };

declare global {
  interface Window {
    AppmaxScripts?: {
      init: (o: {
        externalId?: string;
        onIp?: (r: { ip: string }) => void;
        onTokenize?: (r: { token: string }) => void;
        onError?: (e: { code?: string; message?: string; stage?: string }) => void;
      }) => void;
    };
  }
}

/** Appmax returns Brasília time as "Y-m-d H:i:s". */
const parseExpiry = (s: string) => new Date(`${s.replace(" ", "T")}-03:00`).getTime();

/** Contador de 15 min a partir da entrada no checkout (guardado na sessão, não reinicia ao recarregar). Só visual: não muda preço nem bloqueia a compra; some ao zerar. */
function CheckoutTimer() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    let start = Date.now();
    try {
      const saved = Number(sessionStorage.getItem("vonix-checkout-inicio"));
      if (saved > 0) start = saved;
      else sessionStorage.setItem("vonix-checkout-inicio", String(start));
    } catch {
      /* sem sessionStorage: conta a partir de agora */
    }
    const tick = () => {
      if (start + 15 * 60_000 - Date.now() <= 0) {
        start = Date.now();
        try {
          sessionStorage.setItem("vonix-checkout-inicio", String(start));
        } catch {
          /* segue sem guardar */
        }
      }
      setLeft(start + 15 * 60_000 - Date.now());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  if (left === null || left <= 0) return null;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return (
    <p
      role="timer"
      aria-live="off"
      data-testid="checkout-timer"
      className="flex cursor-default select-none items-center justify-between gap-3 rounded-xl border border-[#c9a45c]/50 bg-gradient-to-b from-[#232323] to-[#0b0b0b] px-4 py-3 text-small font-medium text-white"
    >
      <span className="leading-snug">Você tem 15 minutos para finalizar com tranquilidade</span>
      <span className="money shrink-0 rounded-lg border border-[#c9a45c]/40 bg-black/30 px-3 py-1.5 text-body font-semibold tabular-nums tracking-wider text-[#e3c07a]">
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </span>
    </p>
  );
}

/** Copia o texto mesmo quando o navegador do Instagram/Facebook bloqueia a área de transferência (usa o campo selecionado como plano B). */
async function copyText(text: string, el?: HTMLTextAreaElement | null) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* tenta o plano B */
  }
  try {
    if (el) {
      el.focus();
      el.select();
      el.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    }
  } catch {
    /* sem cópia automática */
  }
  return false;
}

function PixPanel({
  pix,
  paid,
  onCopy,
  copied,
  onRestart,
}: {
  pix: PixResult;
  paid: boolean;
  onCopy: (el: HTMLTextAreaElement | null) => Promise<boolean>;
  copied: boolean;
  onRestart: () => void;
}) {
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [left, setLeft] = useState(() => parseExpiry(pix.expiresAt) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(parseExpiry(pix.expiresAt) - Date.now()), 1000);
    return () => clearInterval(t);
  }, [pix.expiresAt]);
  if (paid)
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-h1">Pagamento confirmado!</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Pedido nº {pix.orderId}. Anote este número: com ele a gente encontra o seu pedido se você precisar de ajuda.
        </p>
        <Link
          to="/loja"
          className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
        >
          Continuar comprando
        </Link>
      </div>
    );
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <h1 className="font-display text-h1">Pague com Pix</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Pedido nº {pix.orderId} · {brl(pix.total)}
      </p>
      {/* Contador do Pix: o prazo é o de verdade, vindo da Appmax (o Pix deixa de valer quando chega a zero). */}
      <p
        role="timer"
        aria-live="off"
        data-testid="pix-timer"
        className="mt-4 flex cursor-default select-none items-center justify-between gap-3 rounded-xl border border-[#c9a45c]/50 bg-gradient-to-b from-[#232323] to-[#0b0b0b] px-4 py-3 text-left text-small font-medium text-white"
      >
        <span className="leading-snug">{left > 0 ? "Seu Pix expira em" : "Este Pix expirou"}</span>
        <span className="money shrink-0 rounded-lg border border-[#c9a45c]/40 bg-black/30 px-3 py-1.5 text-body font-semibold tabular-nums tracking-wider text-[#e3c07a]">
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </span>
      </p>
      {left > 0 ? (
        <button
          type="button"
          onClick={async () => {
            const ok = await onCopy(codeRef.current);
            setCopyFailed(!ok);
          }}
          className="mt-4 w-full rounded-full bg-action py-4 text-name font-semibold text-action-foreground"
        >
          {copied ? "Código copiado!" : "Copiar código Pix"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onRestart}
          className="mt-4 w-full rounded-full bg-action py-4 text-name font-semibold text-action-foreground"
        >
          Gerar um novo Pix
        </button>
      )}
      {copyFailed && (
        <p role="alert" className="mt-2 text-body text-destructive">
          Não conseguimos copiar sozinhos. Toque e segure no código abaixo, escolha "Copiar" e cole no app do seu banco.
        </p>
      )}
      <ol className="mx-auto mt-4 max-w-sm list-decimal space-y-1 pl-5 text-left text-body">
        <li>Toque em <b>Copiar código Pix</b>.</li>
        <li>Abra o app do seu banco e escolha <b>Pix → Pix Copia e Cola</b>.</li>
        <li>Cole o código e confirme o pagamento.</li>
        <li>Pronto: volte aqui, esta tela confirma sozinha.</li>
      </ol>
      <textarea
        ref={codeRef}
        readOnly
        value={pix.emv}
        rows={3}
        aria-label="Código Pix copia e cola"
        className="mt-4 w-full rounded-lg border border-border bg-background p-2 text-small"
        onFocus={(e) => e.currentTarget.select()}
      />
      <details className="mt-4 hidden text-left sm:block" open>
        <summary className="cursor-pointer text-center text-body font-medium">Pagando pelo computador? Leia o QR Code</summary>
        <img
          src={`data:image/png;base64,${pix.qrcode}`}
          alt="QR Code do Pix"
          width={200}
          height={200}
          className="mx-auto mt-3 h-[200px] w-[200px]"
        />
      </details>
      <p className="mt-3 text-body text-muted-foreground">
        {left > 0 ? "" : "Este Pix expirou. Volte e gere outro. "}
        Aguardando pagamento — esta tela atualiza sozinha.
      </p>
    </div>
  );
}

const STEPS = ["Dados", "Entrega", "Pagamento"];

/** Losangos do Pix (desenho próprio, só o símbolo). */
function PixMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
      <g fill="#2fb39a">
        <rect x="9.2" y="1.6" width="5.6" height="5.6" rx="1.2" transform="rotate(45 12 4.4)" />
        <rect x="9.2" y="16.8" width="5.6" height="5.6" rx="1.2" transform="rotate(45 12 19.6)" />
        <rect x="1.6" y="9.2" width="5.6" height="5.6" rx="1.2" transform="rotate(45 4.4 12)" />
        <rect x="16.8" y="9.2" width="5.6" height="5.6" rx="1.2" transform="rotate(45 19.6 12)" />
      </g>
    </svg>
  );
}

/** Bandeiras aceitas no cartão: pequenas etiquetas, só com texto/forma simples. */
function CardBrands() {
  const chip = "grid h-7 place-items-center rounded border border-border bg-white px-1.5 text-[0.65rem] leading-none";
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
      <span className={`${chip} font-bold italic text-[#1a3a8f]`}>VISA</span>
      <span className={`${chip} w-9`}>
        <svg viewBox="0 0 24 16" className="h-4 w-6">
          <circle cx="9" cy="8" r="6" fill="#e32c2b" />
          <circle cx="15" cy="8" r="6" fill="#f79e1b" fillOpacity=".9" />
        </svg>
      </span>
      <span className={`${chip} font-bold text-[#0b3b3a]`}>elo</span>
      <span className={`${chip} hidden font-bold text-[#2a6ebb] sm:grid`}>AMEX</span>
    </span>
  );
}

function Drawer({ children, progress, steps }: { children: React.ReactNode; progress: number; steps: boolean[] }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/50 backdrop-blur-[2px]" style={{ animation: "vx-fade .25s ease-out" }} onClick={() => history.back()}>
      <style>{"@keyframes vx-fade{from{opacity:0}to{opacity:1}}@keyframes vx-slide{from{transform:translateX(100%)}to{transform:none}}"}</style>
      <div
        className="flex h-full w-full max-w-[460px] flex-col bg-background shadow-2xl"
        style={{ animation: "vx-slide .32s cubic-bezier(.22,1,.36,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border bg-background px-4 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <b className="flex items-center gap-2 text-name"><Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Compra segura</b>
            <button type="button" aria-label="Fechar" onClick={() => history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xl leading-none">×</button>
          </div>
          <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            {STEPS.map((n, k) => (
              <div key={n} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${steps[k] ? "bg-emerald-600" : k === steps.filter(Boolean).length ? "bg-emerald-300" : "bg-border"}`} />
                <div className={`mt-1 text-[0.7rem] font-semibold ${steps[k] ? "text-emerald-700" : "text-muted-foreground"}`}>{steps[k] ? "✓ " : ""}{n}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

function Checkout() {
  const [lateral, setLateral] = useState(false);
  useEffect(() => {
    let flag = false;
    try {
      flag = sessionStorage.getItem("vonix-lateral") === "1";
    } catch { /* sem armazenamento */ }
    setLateral(flag || new URLSearchParams(location.search).has("lateral"));
  }, []);
  const c = useCart();
  const hydrated = useHydrated();
  const [f, setF] = useState({
    nome: "",
    email: "",
    cpf: "",
    whatsapp: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const numeroRef = useRef<HTMLInputElement>(null);
  // Checkout curto: com o endereço já preenchido pelo CEP, rua/bairro/cidade/UF ficam recolhidos numa linha só.
  const [editAddr, setEditAddr] = useState(false);
  const [showCompl, setShowCompl] = useState(false);
  const lastQuotedCep = useRef("");
  const [quoteTry, setQuoteTry] = useState(0);
  const compactAddr = !editAddr && !!(f.rua && f.bairro && f.cidade && f.uf);
  const [pay, setPay] = useState<"pix" | "card">("pix");
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applied, setApplied] = useState<Coupon | null>(null);
  const [options, setOptions] = useState<ShipOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [card, setCard] = useState({ number: "", holder: "", month: "", year: "", cvv: "" });
  const [parcels, setParcels] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // O aviso de erro some assim que o cliente mexe em algum campo (não fica um erro velho na tela).
  useEffect(() => {
    setError(null);
  }, [f, pay, card, parcels, serviceId]);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardDone, setCardDone] = useState<{ orderId: number; paid: boolean } | null>(null);
  const [cfg, setCfg] = useState<{
    externalId: string;
    sandbox: boolean;
    pixEnabled?: boolean;
  } | null>(null);
  const ip = useRef("");
  useEffect(() => {
    if (!f.nome && !f.email && !f.whatsapp) return;
    try {
      localStorage.setItem(
        "vonix-checkout-contato",
        JSON.stringify({ nome: f.nome, email: f.email, whatsapp: f.whatsapp }),
      );
    } catch { /* sem armazenamento */ }
  }, [f.nome, f.email, f.whatsapp]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((old) => ({ ...old, [k]: e.target.value }));

  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setF((old) => (old.cep ? old : { ...old, cep: saved }));
    // Quem volta ao checkout não redigita: nome, e-mail e WhatsApp ficam só neste aparelho (nunca CPF nem cartão).
    try {
      const d = JSON.parse(localStorage.getItem("vonix-checkout-contato") || "{}");
      setF((old) => ({
        ...old,
        nome: old.nome || (typeof d.nome === "string" ? d.nome : ""),
        email: old.email || (typeof d.email === "string" ? d.email : ""),
        whatsapp: old.whatsapp || (typeof d.whatsapp === "string" ? d.whatsapp : ""),
      }));
    } catch { /* sem armazenamento */ }
    getPaymentConfig()
      .then(setCfg)
      .catch(() => setCfg({ externalId: "", sandbox: true, pixEnabled: false }));
    // A coupon won on the prize wheel is applied automatically.
    const prize = getPrize();
    if (prize) {
      setApplied(prize);
      setShowCoupon(true);
      setCoupon(prize.code);
      setCouponMsg(`Cupom ${prize.code} aplicado: ${prize.label}.`);
    }
    // Veio pelo link de uma afiliada: o cupom com o nome dela (ex.: MARISSOL10) entra sozinho, se o app de afiliadas confirmar.
    const ref = getRef();
    if (ref) {
      const code = `${ref.toUpperCase()}10`;
      lookupCoupon({ data: { code } })
        .then((r) => {
          if (!r.ok) return;
          setApplied({ code: r.code, label: r.label, percent: r.percent });
          setShowCoupon(true);
          setCoupon(r.code);
          setCouponMsg(`Cupom ${r.code} aplicado: ${r.label}.`);
        })
        .catch(() => undefined);
    }
  }, []);

  const hasLines = c.lines.length > 0;
  useEffect(() => {
    if (hasLines)
      track("begin_checkout", {
        value: c.netSubtotal,
        items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)),
      });
  }, [hasLines]);

  const items = c.lines.map((l) => ({
    slug: l.slug,
    variant: l.variant,
    qty: l.qty,
    ...(l.offer ? { offer: l.offer } : {}),
  }));
  const itemsKey = JSON.stringify(items);
  const addressFilled = useCallback(
    (address: { street: string; district: string; city: string; uf: string }) => {
      setF((old) => ({
        ...old,
        rua: address.street,
        bairro: address.district,
        cidade: address.city,
        uf: address.uf,
      }));
      numeroRef.current?.focus();
    },
    [],
  );
  const { loading: cepLoading, message: cepMsg } = useCepAddress(f.cep, addressFilled);

  // Shipping quote (Melhor Envio) whenever a full CEP or the cart changes.
  useEffect(() => {
    const d = f.cep.replace(/\D/g, "");
    setOptions([]);
    // CEP novo escolhe o frete de novo; cupom ou carrinho novo mantêm o que o cliente já tinha escolhido (se ainda existir).
    if (lastQuotedCep.current !== d) setServiceId(null);
    lastQuotedCep.current = d;
    setQuoteErr(null);
    if (d.length !== 8 || !items.length) {
      setQuoting(false);
      return;
    }
    saveCep(f.cep);
    let cancelled = false;
    setQuoting(true);
    setQuoteErr(null);
    quoteShipping({ data: { cep: d, items, ...(applied ? { coupon: applied.code } : {}) } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          // 3 opções: as 2 mais baratas + 1 intermediária mais rápida (a mais barata que chega em até 3 dias; senão a do meio).
          // NENHUMA vem marcada: quem escolhe o frete é o cliente.
          const byPrice = [...r.options].sort((a, b) => a.price - b.price || a.days - b.days);
          const rest = byPrice.slice(2);
          const medium = rest.find((o) => o.days <= 3) ?? rest[Math.floor((rest.length - 1) / 2)];
          const picked = [...byPrice.slice(0, 2), ...(medium ? [medium] : [])];
          setOptions(picked);
          setServiceId((cur) => (picked.some((o) => o.id === cur) ? cur : null));
          if (!r.options.length)
            setQuoteErr("Nenhuma transportadora atende este CEP. Fale com a gente no WhatsApp.");
        } else {
          setOptions([]);
          setServiceId(null);
          setQuoteErr(r.message);
        }
      })
      .catch(
        () =>
          !cancelled && setQuoteErr("Não foi possível calcular o frete agora. Tente novamente."),
      )
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [f.cep, itemsKey, applied?.code, quoteTry]);

  const gross = checkoutTotals(c.lines, "card").gross;
  const pct = couponPercent(applied ?? undefined, gross);
  const t = checkoutTotals(c.lines, pay, pct);
  const tPix = checkoutTotals(c.lines, "pix", pct);
  const tCard = checkoutTotals(c.lines, "card", pct);
  const couponProblem = applied ? couponCheck(applied, gross) : null;
  const chosen = options.find((o) => o.id === serviceId) ?? null;
  const shippingEvent = useRef("");
  useEffect(() => {
    if (!chosen || quoting) return;
    const key = JSON.stringify([
      f.cep.replace(/\D/g, ""),
      itemsKey,
      applied?.code,
      chosen.id,
      chosen.price,
    ]);
    if (shippingEvent.current === key) return;
    shippingEvent.current = key;
    track("add_shipping_info", {
      shipping_tier: `${chosen.company} ${chosen.name}`,
      value: c.netSubtotal,
      items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)),
    });
  }, [chosen, quoting, f.cep, itemsKey, applied?.code, c.lines, c.netSubtotal]);
  const shipping = chosen ? chosen.price : 0;
  const total = t.net + shipping;

  const applyCoupon = async () => {
    if (!coupon.trim()) return setCouponMsg("Digite um código de cupom.");
    let found = findCoupon(coupon);
    if (!found && isAffiliateCouponCode(coupon)) {
      setCouponMsg("Conferindo o cupom…");
      const r = await lookupCoupon({ data: { code: coupon.trim().toUpperCase() } }).catch(() => ({ ok: false as const }));
      if (r.ok) found = { code: r.code, label: r.label, percent: r.percent };
    }
    if (!found) return setCouponMsg("Cupom não encontrado. Confira o código.");
    const chk = couponCheck(found, gross);
    setApplied(found);
    setCouponMsg(chk.ok ? `Cupom ${found.code} aplicado: ${found.label}.` : chk.reason);
  };

  const finish = (orderId: number, value: number) => {
    track("purchase", {
      transaction_id: String(orderId),
      value,
      shipping,
      items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)),
    });
    c.clear();
    clearRef(); // o link da afiliada vale para uma compra só: depois de paga, as próximas são vendas normais
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Pix: poll the order until Appmax reports it as paid.
  useEffect(() => {
    if (!pix || paid) return;
    const timer = setInterval(async () => {
      const r = await getOrderStatus({ data: { orderId: pix.orderId } }).catch(() => null);
      if (r?.ok && r.paid) {
        setPaid(true);
        finishRef.current(pix.orderId, pix.total);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pix, paid]);

  const submitPayment = async (token?: string) => {
    if (!chosen) {
      setError("Escolha a forma de entrega.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await createPayment({
        data: {
          customer: { nome: f.nome, email: f.email, cpf: f.cpf, whatsapp: f.whatsapp },
          address: {
            cep: f.cep,
            rua: f.rua,
            numero: f.numero,
            complemento: f.complemento,
            bairro: f.bairro,
            cidade: f.cidade,
            uf: f.uf,
          },
          items,
          serviceId: chosen.id,
          method: pay,
          ...(applied ? { coupon: applied.code } : {}),
          ...(ip.current ? { ip: ip.current } : {}),
          ...(getRef() ? { ref: getRef() as string } : {}),
          ...(token ? { token, holderName: card.holder, installments: parcels } : {}),
        },
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (r.method === "pix") {
        setPix({
          orderId: r.orderId,
          total: r.total,
          emv: r.pix.emv,
          qrcode: r.pix.qrcode,
          expiresAt: r.pix.expiresAt,
        });
        window.scrollTo({ top: 0 });
      } else {
        setCardDone({ orderId: r.orderId, paid: r.paid });
        if (r.paid) finish(r.orderId, r.total);
        else
          setError(
            "Pagamento em análise ou não aprovado. Confira com seu banco ou tente outro cartão ou o Pix.",
          );
      }
    } catch {
      setError(
        "Não conseguimos enviar seu pedido. Confira nome, e-mail, WhatsApp, CPF e endereço e tente de novo. Se continuar, fale com a gente no WhatsApp.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submitPaymentRef = useRef(submitPayment);
  submitPaymentRef.current = submitPayment;

  // Card: Appmax JS tokenizes the card fields; the number never reaches our server.
  useEffect(() => {
    if (!cfg?.externalId) return;
    const s = document.createElement("script");
    s.src = cfg.sandbox
      ? "https://scripts.sandboxappmax.com.br/appmax.min.js"
      : "https://scripts.appmax.com.br/appmax.min.js";
    s.async = true;
    s.onload = () =>
      window.AppmaxScripts?.init({
        externalId: cfg.externalId,
        onIp: ({ ip: v }) => {
          ip.current = v;
        },
        onTokenize: ({ token }) => void submitPaymentRef.current(token),
        onError: () => {
          setBusy(false);
          setError("Não foi possível validar o cartão. Confira os dados e tente de novo.");
        },
      });
    document.body.appendChild(s);
    return () => {
      s.remove();
    };
  }, [cfg?.externalId, cfg?.sandbox]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Avisa qual campo está errado e leva o cursor até ele (a tela rola sozinha até o campo).
    const fail = (msg: string, field: string) => {
      setError(msg);
      document.querySelector<HTMLInputElement>(`input[aria-label="${field}"]`)?.focus();
    };
    const phone = f.whatsapp.replace(/\D/g, "");
    if (f.nome.trim().length < 3) return fail("Digite seu nome completo.", "Nome completo");
    if (phone.length < 10 || phone.length > 13)
      return fail("Digite seu WhatsApp com DDD, por exemplo (31) 99999-9999.", "WhatsApp com DDD");
    if (!isValidCpf(f.cpf)) return fail("CPF inválido. Confira os números.", "CPF");
    track("add_payment_info", { payment_type: pay, value: total });
    if (pay === "pix") void submitPayment();
    else if (!cfg?.externalId) setError("Pagamento por cartão indisponível no momento. Use o Pix.");
    else {
      const cardForm = document.getElementById("card-form");
      if (!(cardForm instanceof HTMLFormElement) || !cardForm.reportValidity()) return;
      setBusy(true);
      setError(null);
      cardForm.requestSubmit();
    }
  };

  if (pix)
    return (
      <Shell>
        <div className="container-site max-w-xl py-10">
          <PixPanel
            pix={pix}
            paid={paid}
            copied={copied}
            onRestart={() => {
              setPix(null);
              setCopied(false);
              setError(null);
            }}
            onCopy={async (el) => {
              const ok = await copyText(pix.emv, el);
              if (ok) setCopied(true);
              return ok;
            }}
          />
        </div>
      </Shell>
    );

  if (cardDone?.paid)
    return (
      <Shell>
        <div className="container-site max-w-xl py-16 text-center" role="status">
          <h1 className="font-display text-h1">Pagamento aprovado!</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Pedido nº {cardDone.orderId}. Anote este número: com ele a gente encontra o seu pedido se você precisar de ajuda.
          </p>
          <Link
            to="/loja"
            className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
          >
            Continuar comprando
          </Link>
        </div>
      </Shell>
    );

  if (!hydrated)
    return (
      <Shell>
        <div className="container-site min-h-[50vh] py-20" aria-busy="true" />
      </Shell>
    );

  if (!c.lines.length)
    return (
      <Shell>
        <div className="container-site py-20 text-center">
          <p>Seu carrinho está vazio.</p>
          <Link to="/loja" className="mt-4 inline-block underline">
            Ver produtos
          </Link>
        </div>
      </Shell>
    );

  const cardTotal = tCard.net + shipping;
  const card6 = installments(cardTotal, 6);
  const freeShip = missingForFreeShipping(gross) === 0;
  const shipNote = chosen ? (chosen.free ? "frete grátis" : "com frete") : freeShip ? "frete grátis" : "sem frete";
  const selectedInstallments = installmentText(total, parcels);
  const payDisabled = busy || quoting || !chosen || !cfg || !cfg.pixEnabled;
  // Botão de pagar: o de verdade fica dentro da caixa do método escolhido; quando ele sai da tela, uma barra fixa o repete.
  const renderPay = (floating: boolean) => (
    <>
      {/* O erro aparece sempre junto do botão que o cliente está vendo: na barra fixa, ou na caixa quando o botão está na tela. */}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive bg-white p-2.5 text-small text-destructive">
          {error}
        </p>
      )}
      {!chosen && !quoting && (
        <p className="text-center text-small text-muted-foreground">
          {options.length > 0 ? "Escolha o frete para liberar o pagamento" : "Digite o CEP para liberar o pagamento"}
        </p>
      )}
      <button
        type={floating ? "button" : "submit"}
        form={floating ? undefined : "checkout-form"}
        onClick={floating ? () => (document.getElementById("checkout-form") as HTMLFormElement | null)?.requestSubmit() : undefined}
        disabled={payDisabled}
        data-testid={floating ? "checkout-pay-float" : "checkout-pay-button"}
        className="group flex w-full items-center gap-3 rounded-xl border border-[#c9a45c]/60 bg-gradient-to-b from-[#232323] to-[#0b0b0b] px-4 py-3 text-left text-white shadow-[0_14px_28px_-14px_rgba(0,0,0,0.75)] transition hover:from-[#2d2d2d] hover:to-[#111] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-border disabled:from-neutral-200 disabled:to-neutral-200 disabled:text-neutral-500 disabled:shadow-none"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#c9a45c]/70 bg-black/30 text-[#e3c07a] group-disabled:border-neutral-300 group-disabled:bg-transparent group-disabled:text-neutral-400">
          <Lock className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-name font-semibold tracking-wide">
            {busy ? "Processando…" : pay === "pix" ? `Gerar Pix · ${brl(total)}` : `Pagar ${installmentText(total, parcels, parcels > 1)} no cartão`}
          </span>
          <span className="mt-0.5 block text-[0.72rem] font-normal tracking-wide text-white/70 group-disabled:text-neutral-500">
            Pagamento seguro
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-[#e3c07a] transition group-hover:translate-x-0.5 group-disabled:text-neutral-400" strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  );
  const stepsDone = [!!(f.nome && f.email && f.whatsapp && f.cpf), !!chosen, false];
  const progress = (stepsDone.filter(Boolean).length + 1) / 3;

  const totalsCard = (
            <section aria-label="Resumo do pedido" data-testid="order-summary-body" className={`${panel} space-y-2`}>
              <div className="space-y-2 text-body" data-testid="summary">
                <div className="flex justify-between">
                  <span>Produtos</span>
                  <span>{brl(t.gross)}</span>
                </div>
                {t.offerDiscount > 0 && (
                  <div className="flex justify-between text-[#2c6e55]">
                    <span>Economia das ofertas</span>
                    <span>− {brl(t.offerDiscount)}</span>
                  </div>
                )}
                {t.couponDiscount > 0 && applied && (
                  <div className="flex justify-between text-[#2c6e55]">
                    <span>Cupom {applied.code}</span>
                    <span>− {brl(t.couponDiscount)}</span>
                  </div>
                )}
                {t.pixDiscount > 0 && (
                  <div className="flex justify-between text-[#2c6e55]">
                    <span>Desconto no Pix</span>
                    <span>− {brl(t.pixDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Frete</span>
                  <span>{chosen ? (chosen.free ? "Grátis" : brl(chosen.price)) : freeShip ? "Grátis" : "A calcular"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border-t border-[#c9a45c]/50 bg-[#fbf5e6] px-3 py-2.5 text-name font-bold">
                  <span className="min-w-0">
                    {chosen || freeShip ? `Total ${pay === "pix" ? "no Pix" : "no cartão"}` : `Produtos ${pay === "pix" ? "no Pix" : "no cartão"}`}
                  </span>
                  <span className="money text-h2">{brl(total)}</span>
                </div>
                {!(chosen ? chosen.free : freeShip) && (
                  <p className="text-small text-muted-foreground">
                    {chosen ? "Total com o frete escolhido." : "Total final após calcular o frete."}
                  </p>
                )}
                <div className="flex justify-center">
                  <SecuritySeal />
                </div>
                {pay === "card" && (
                  <div className="min-w-0 break-words text-small text-muted-foreground" aria-live="polite">
                    Parcelamento escolhido: {selectedInstallments}
                  </div>
                )}
              </div>
            </section>
  );

  const body = (
      <div className={lateral ? "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 p-3" : "container-site mx-auto grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-28 pt-0 sm:pt-4"} style={lateral ? undefined : { maxWidth: "42rem" }}>
        <div className="min-w-0 space-y-3">
          <form id="checkout-form" className="min-w-0 space-y-3" onSubmit={onSubmit}>
            {!lateral && (
              <div data-testid="checkout-hero" className="relative -mx-4 flex min-h-[176px] items-center overflow-hidden bg-[#1a1209] sm:mx-0 sm:rounded-2xl">
                <img src="/images/categorias/hidratacao.jpg" alt="" width={480} height={480} className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[50%_38%]" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#1a1209] via-[#1a1209]/85 to-transparent" />
                <div className="relative px-5 py-6">
                  <img src={heroLogo} alt="Vonix Hair" width={420} height={163} className="h-11 w-auto brightness-0 invert" />
                  <p className="mt-2 font-display text-body italic text-[#e3c07a]">Seu cuidado começa aqui</p>
                </div>
              </div>
            )}
            <CheckoutTimer />
            <div className="pt-1">
              {!lateral && (
                <p className="mb-1 flex items-center gap-3 text-small font-semibold uppercase tracking-[0.14em] text-[#8a6a1c]">
                  Pedido à vista
                  <span aria-hidden="true" className="h-px flex-1 bg-[#c9a45c]/50" />
                </p>
              )}
              <h1 className={lateral ? "sr-only" : "font-display text-h1 leading-tight"}>Sua compra, sem surpresas</h1>
            </div>

            <section aria-label="Revise seu pedido" data-testid="checkout-review" className={`${panel} space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-name">Revise seu pedido</h2>
                <Link to="/carrinho" className="shrink-0 text-small font-medium text-[#8a6a1c] underline">
                  Editar pedido
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {c.lines.map((l) => (
                  <li
                    key={l.slug + l.variant + (l.offer ?? "")}
                    className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <img
                      src={l.product.images[0]}
                      alt={l.product.name}
                      width={104}
                      height={104}
                      className="h-[92px] w-[92px] rounded-2xl bg-card-image object-contain p-2 shadow-[inset_0_0_0_1px_rgba(201,164,92,0.28)]"
                    />
                    <div className="min-w-0 space-y-3">
                      <b className="block break-words text-name font-semibold leading-snug">
                        {l.product.name} <span className="font-medium text-muted-foreground">• {l.variant}</span>
                      </b>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="inline-flex items-center rounded-lg border border-border bg-white" role="group" aria-label={`Quantidade de ${l.product.name}`}>
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            disabled={l.qty <= 1}
                            onClick={() => c.setQty(l.slug, l.variant, l.qty - 1, l.offer)}
                            className="grid h-9 w-9 place-items-center text-name disabled:opacity-35"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-body font-semibold" aria-live="polite">
                            {l.qty}
                          </span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            onClick={() => c.setQty(l.slug, l.variant, l.qty + 1, l.offer)}
                            className="grid h-9 w-9 place-items-center text-name"
                          >
                            +
                          </button>
                        </div>
                        <span className="money whitespace-nowrap text-name font-bold">{brl(l.net)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>


            <p className="flex cursor-default select-none items-center gap-2 text-small font-medium text-[#2c6e55]">
              <Truck className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {missingForFreeShipping(gross) > 0
                ? `Faltam ${brl(missingForFreeShipping(gross))} para ganhar frete grátis`
                : "Você ganhou frete grátis"}
            </p>

            <fieldset className="space-y-2">
              <StepTitle n={1}>Como você quer pagar?</StepTitle>
              <div className="grid grid-cols-1 gap-2">
                <label data-testid="pay-option-pix" className={payTile(pay === "pix")}>
                  <span className="flex min-w-0 items-center justify-between gap-2 text-body font-semibold">
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="radio"
                        name="pay"
                        aria-label="Pix"
                        className="h-5 w-5 shrink-0 accent-[#e3c07a]"
                        checked={pay === "pix"}
                        onChange={() => setPay("pix")}
                      />
                      <span className="truncate">Pix</span>
                    </span>
                    <PixMark />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="money block text-name font-semibold">{brl(chosen ? tPix.net + shipping : tPix.net)}</span>
                    {(!chosen || chosen.free) && <span className={`block text-small ${pay === "pix" ? "text-white/70" : "text-muted-foreground"}`}>{chosen?.free || freeShip ? "Frete grátis" : "sem frete"}</span>}
                  </span>
                </label>
                <label data-testid="pay-option-card" className={payTile(pay === "card")}>
                  <span className="flex min-w-0 items-center justify-between gap-2 text-body font-semibold">
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="radio"
                        name="pay"
                        aria-label="Cartão de crédito"
                        className="h-5 w-5 shrink-0 accent-[#e3c07a]"
                        checked={pay === "card"}
                        onChange={() => setPay("card")}
                      />
                      <span className="truncate">Cartão</span>
                    </span>
                    <CreditCard className={`h-6 w-6 shrink-0 ${pay === "card" ? "text-[#e3c07a]" : "text-neutral-500"}`} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 leading-tight"
                    aria-live="polite"
                  >
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-name font-bold tabular-nums">
                        {brl(cardTotal)}
                      </span>
                      <span className="block text-small">Valor total · {shipNote}</span>
                    </span>
                    <span className="min-w-0 text-body font-semibold leading-snug tabular-nums">
                      {card6.count}x de {brl(card6.value)} sem juros
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className={panel}>
              <StepTitle n={2}>Onde vamos entregar?</StepTitle>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  required
                  inputMode="numeric"
                  aria-label="CEP"
                  placeholder="CEP"
                  value={f.cep}
                  maxLength={9}
                  onChange={(e) => {
                    const m = maskCep(e.target.value);
                    // CEP novo = endereço novo: apaga o do CEP anterior para nunca ficar rua/cidade de outro lugar escondida.
                    setF((old) => (old.cep === m ? old : { ...old, cep: m, rua: "", bairro: "", cidade: "", uf: "" }));
                  }}
                  autoComplete="postal-code"
                  className={inp}
                />
                <button
                  type="button"
                  onClick={() => setQuoteTry((n) => n + 1)}
                  disabled={f.cep.replace(/\D/g, "").length !== 8 || quoting}
                  className="h-11 rounded-lg bg-foreground px-5 text-body font-semibold text-background transition active:scale-[0.98] disabled:opacity-40"
                >
                  Calcular
                </button>
              </div>
              <p className="text-small text-muted-foreground">Veja valor e prazo da entrega.</p>
              <input
                ref={numeroRef}
                required
                inputMode="numeric"
                aria-label="Número"
                placeholder="Número"
                value={f.numero}
                onChange={set("numero")}
                autoComplete="off"
                className={inp}
              />
{cepLoading && (
                <p role="status" className="text-body text-muted-foreground">
                  Buscando endereço…
                </p>
              )}
              {cepMsg && !cepLoading && (
                <p role="status" className="text-body text-muted-foreground">
                  {cepMsg}
                </p>
              )}
              {compactAddr && (
                <div data-testid="checkout-address-summary" className="space-y-2">
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3.5 text-body">
                    <span className="min-w-0">
                      <b className="block">{f.rua}{f.numero ? `, ${f.numero}` : ""}</b>
                      <span className="block text-muted-foreground">
                        {f.bairro} · {f.cidade}/{f.uf}
                      </span>
                      {f.complemento && <span className="block text-muted-foreground">{f.complemento}</span>}
                    </span>
                    <button type="button" onClick={() => setEditAddr(true)} className="shrink-0 text-small underline">
                      Corrigir
                    </button>
                  </div>
                  {!showCompl && !f.complemento ? (
                    <button type="button" onClick={() => setShowCompl(true)} className="text-small underline">
                      + Adicionar complemento (apto, bloco)
                    </button>
                  ) : (
                    <input
                      aria-label="Complemento"
                      placeholder="Complemento (opcional)"
                      value={f.complemento}
                      onChange={set("complemento")}
                      autoComplete="address-line2"
                      className={inp}
                    />
                  )}
                </div>
              )}
              {!compactAddr && (<>
              <input
                required
                aria-label="Rua"
                placeholder="Rua"
                value={f.rua}
                onChange={set("rua")}
                autoComplete="address-line1"
                className={`${inp} ${f.rua ? tint : ""}`}
              />
<div className="grid grid-cols-2 gap-2">
<input
                required
                aria-label="Bairro"
                placeholder="Bairro"
                value={f.bairro}
                onChange={set("bairro")}
                autoComplete="address-level3"
                className={`${inp} ${f.bairro ? tint : ""}`}
              />
<input
                  aria-label="Complemento"
                  placeholder="Complemento (opcional)"
                  value={f.complemento}
                  onChange={set("complemento")}
                  autoComplete="address-line2"
                  className={inp}
                />
</div>
<div className="grid grid-cols-[1fr_72px] gap-2">
<input
                  required
                  aria-label="Cidade"
                  placeholder="Cidade"
                  value={f.cidade}
                  onChange={set("cidade")}
                  autoComplete="address-level2"
                  className={`${inp} ${f.cidade ? tint : ""}`}
                />
<input
                  required
                  aria-label="UF"
                  placeholder="UF"
                  value={f.uf}
                  onChange={set("uf")}
                  maxLength={2}
                  autoComplete="address-level1"
                  className={`${inp} ${f.uf ? tint : ""}`}
                />
</div>
              </>)}

              <div className="space-y-2 pt-2" aria-live="polite">
                {quoting && <p className="text-body text-muted-foreground">Calculando frete…</p>}
                {quoteErr && !quoting && (
                  <div className="space-y-1">
                    <p role="alert" className="text-body text-destructive">
                      {quoteErr}
                    </p>
                    {/* Falha passageira: o cliente tenta de novo sem precisar digitar o CEP outra vez. */}
                    {/calcular o frete agora/.test(quoteErr) && (
                      <button type="button" onClick={() => setQuoteTry((n) => n + 1)} className="text-small underline">
                        Tentar de novo
                      </button>
                    )}
                  </div>
                )}
                {!quoting &&
                  options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-center justify-between rounded-lg border-2 p-3.5 text-body ${serviceId === o.id ? "border-action bg-card font-medium" : "border-border"}`}
                    >
                      <span className="flex gap-2">
                        <input
                          type="radio"
                          name="frete"
                          checked={serviceId === o.id}
                          onChange={() => setServiceId(o.id)}
                        />
                        <span>
                          {shippingText(o).title}{" "}
                          <span className="text-muted-foreground">· {shippingText(o).eta}</span>
                        </span>
                      </span>
                      <b>{o.free ? "Grátis" : brl(o.price)}</b>
                    </label>
                  ))}
              </div>
            </fieldset>

            <fieldset className={panel}>
              <StepTitle n={3}>Seus dados</StepTitle>
              <input
                required
                aria-label="Nome completo"
                placeholder="Nome completo"
                value={f.nome}
                onChange={set("nome")}
                autoComplete="name"
                className={inp}
              />
              <input
                required
                type="email"
                inputMode="email"
                aria-label="E-mail"
                placeholder="E-mail"
                value={f.email}
                onChange={set("email")}
                autoComplete="email"
                className={inp}
              />
              <div className="space-y-2">
<input
                required
                inputMode="tel"
                aria-label="WhatsApp com DDD"
                placeholder="WhatsApp"
                value={f.whatsapp}
                onChange={set("whatsapp")}
                autoComplete="tel"
                className={inp}
              />
              <input
                required
                inputMode="numeric"
                aria-label="CPF"
                placeholder="CPF"
                value={f.cpf}
                maxLength={14}
                onChange={(e) => setF((old) => ({ ...old, cpf: maskCpf(e.target.value) }))}
                className={inp}
              />
</div>
              <p className="flex items-start gap-2 pt-1 text-small text-muted-foreground" data-testid="dados-confianca">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>Usamos o CPF só para emitir o pedido e o e-mail e o WhatsApp só para enviar o rastreio. O pagamento é processado pela Appmax e você tem 7 dias para desistir da compra.</span>
              </p>
              </fieldset>

            {totalsCard}


          </form>

          {/* Card fields live in their own form so Appmax JS can tokenize them; the main form triggers it. */}
          <div>
            {/* Dados do cartão: caixa própria logo abaixo da escolha de pagamento (só aparece com o cartão marcado). */}
            <form
              id="card-form"
              data-appmax-checkout
              hidden={pay !== "card"}
              data-testid="card-form"
              className="min-w-0 space-y-3 rounded-2xl border border-[#c9a45c]/60 bg-white p-4 shadow-[0_6px_18px_-14px_rgba(60,40,10,0.35)]"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                form="card-form"
                required
                name="card-holder-name"
                aria-label="Nome no cartão"
                autoComplete="cc-name"
                placeholder="Nome no cartão"
                value={card.holder}
                onChange={(e) => setCard((o) => ({ ...o, holder: e.target.value }))}
                className={`${inp} h-12`}
              />
              <div className="relative">
                <input
                  form="card-form"
                  required
                  name="card-number"
                  aria-label="Número do cartão"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 1234 1234 1234"
                  value={card.number}
                  onChange={(e) =>
                    setCard((o) => ({
                      ...o,
                      number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23),
                    }))
                  }
                  className={`${inp} h-12 pr-12`}
                />
                <CreditCard className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input
                  form="card-form"
                  required
                  name="exp-month"
                  aria-label="Mês de validade"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  placeholder="MM"
                  maxLength={2}
                  value={card.month}
                  onChange={(e) =>
                    setCard((o) => ({ ...o, month: e.target.value.replace(/\D/g, "") }))
                  }
                  className={`${inp} h-12`}
                />
                <input
                  form="card-form"
                  required
                  name="exp-year"
                  aria-label="Ano de validade"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  placeholder="AAAA"
                  maxLength={4}
                  value={card.year}
                  onChange={(e) =>
                    setCard((o) => ({ ...o, year: e.target.value.replace(/\D/g, "") }))
                  }
                  className={`${inp} h-12`}
                />
                <div className="relative">
                  <input
                    form="card-form"
                    required
                    name="cvv"
                    aria-label="CVV"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    maxLength={4}
                    value={card.cvv}
                    onChange={(e) =>
                      setCard((o) => ({ ...o, cvv: e.target.value.replace(/\D/g, "") }))
                    }
                    className={`${inp} h-12 pr-9`}
                  />
                  <CreditCard className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                </div>
              </div>
              <select
                aria-label="Parcelas"
                value={parcels}
                onChange={(e) => setParcels(Number(e.target.value))}
                className={`${inp} h-12`}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}x de {brl(installments(total, n).value)} sem juros
                  </option>
                ))}
              </select>
            </form>
            <form data-appmax-customer hidden />
          </div>

          <div className="space-y-2">
            {showCoupon && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    aria-label="Código do cupom"
                    placeholder="Código do cupom"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    className={inp}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="shrink-0 rounded-lg border border-foreground px-4 text-body"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    aria-label="Remover cupom"
                    onClick={() => {
                      setShowCoupon(false);
                      setCoupon("");
                      setCouponMsg(null);
                      setApplied(null);
                    }}
                    className="shrink-0 text-body underline"
                  >
                    Remover
                  </button>
                </div>
                {couponMsg && (
                  <p role="alert" className="text-body text-muted-foreground">
                    {couponMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <div
            data-testid="checkout-pay-bar"
            className={lateral
              ? "sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur"
              : "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 py-3 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.3)]"}
          >
            <div className="mx-auto w-full max-w-xl space-y-2">{renderPay(true)}</div>
          </div>
          <p className="text-center text-small text-muted-foreground">
            Vonix Hair · CNPJ 68.272.005/0001-07 · 7 dias para desistir da compra, conforme a lei
          </p>
          <p className="text-center text-body text-muted-foreground">
            Dúvidas?{" "}
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">
              Fale no WhatsApp
            </a>
          </p>
        </div>
      </div>
  );
  return lateral ? <Drawer progress={progress} steps={stepsDone}>{body}</Drawer> : <Shell>{body}</Shell>;
}
