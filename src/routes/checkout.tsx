import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { SecuritySeal, Shell } from "@/components/site";
import { ShippingBar } from "@/components/cart-summary";
import { ProvasEmVideo } from "@/components/provas-em-video";
import { useCepAddress } from "@/hooks/use-cep-address";
import { toItem, track } from "@/lib/analytics";
import { isValidCpf } from "@/lib/cpf";
import { getRef } from "@/lib/affiliate-ref";
import {
  createPayment,
  getOrderStatus,
  getPaymentConfig,
  lookupCoupon,
  quoteShipping,
} from "@/lib/checkout.functions";
import {
  OFFER_LABEL,
  WHATSAPP,
  brl,
  checkoutTotals,
  getSavedCep,
  installments,
  maskCep,
  missingForFreeShipping,
  saveCep,
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
  "space-y-2 rounded-xl border border-border bg-white p-3.5 sm:p-4";

const StepTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <>
  <legend className="float-left mb-2 w-full text-body font-bold" data-step={n}>
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

function PixPanel({
  pix,
  paid,
  onCopy,
  copied,
  onRestart,
}: {
  pix: PixResult;
  paid: boolean;
  onCopy: () => void;
  copied: boolean;
  onRestart: () => void;
}) {
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
          Pedido nº {pix.orderId}. Você receberá os detalhes por e-mail e WhatsApp.
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
      <img
        src={`data:image/png;base64,${pix.qrcode}`}
        alt="QR Code do Pix"
        width={220}
        height={220}
        className="mx-auto mt-4 h-[220px] w-[220px]"
      />
      <p className="mt-4 text-body">
        Abra o app do seu banco, escolha Pix e leia o QR Code, ou copie o código abaixo.
      </p>
      <textarea
        readOnly
        value={pix.emv}
        rows={3}
        className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-small"
        onFocus={(e) => e.currentTarget.select()}
      />
      {left > 0 ? (
        <button
          type="button"
          onClick={onCopy}
          className="mt-3 w-full rounded-full bg-action py-3 font-medium text-action-foreground"
        >
          {copied ? "Código copiado!" : "Copiar código Pix"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onRestart}
          className="mt-3 w-full rounded-full bg-action py-3 font-medium text-action-foreground"
        >
          Gerar um novo Pix
        </button>
      )}
      <p className="mt-3 text-body text-muted-foreground">
        {left > 0
          ? `Expira em ${mm}:${String(ss).padStart(2, "0")}. `
          : "Este Pix expirou. Volte e gere outro. "}
        Aguardando pagamento — esta tela atualiza sozinha.
      </p>
    </div>
  );
}

const STEPS = ["Contato", "Entrega", "Pagamento"];

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
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((old) => ({ ...old, [k]: e.target.value }));

  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setF((old) => (old.cep ? old : { ...old, cep: saved }));
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
    setServiceId(null);
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
          setOptions(r.options);
          setServiceId((cur) =>
            r.options.some((o) => o.id === cur) ? cur : (r.options[0]?.id ?? null),
          );
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
  }, [f.cep, itemsKey, applied?.code]);

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
      setError("Não conseguimos processar agora. Tente novamente em instantes.");
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
    if (!isValidCpf(f.cpf)) {
      setError("CPF inválido. Confira os números.");
      return;
    }
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
            onCopy={() => {
              navigator.clipboard
                ?.writeText(pix.emv)
                .then(() => setCopied(true))
                .catch(() => undefined);
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
            Pedido nº {cardDone.orderId}. Você receberá os detalhes por e-mail e WhatsApp.
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

  const inst = installments(total);
  const stepsDone = [!!(f.nome && f.email && f.whatsapp && f.cpf), !!chosen, false];
  const progress = (stepsDone.filter(Boolean).length + 1) / 3;

  const body = (
      <div className={lateral ? "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 p-3" : "container-site grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 py-4 lg:gap-8 lg:py-8 lg:grid-cols-[minmax(0,1fr)_380px]"}>
        <div className="min-w-0 space-y-3">
          <form id="checkout-form" className="min-w-0 space-y-3" onSubmit={onSubmit}>
            <div>
              <h1 className={lateral ? "sr-only" : "font-display text-h2 lg:text-h1"}>Finalizar compra</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-emerald-600 px-3 py-2 text-small font-semibold text-white">
                <span className="rounded bg-white px-1.5 py-0.5 text-[0.7rem] font-extrabold uppercase text-emerald-700">5% OFF</span>
                {missingForFreeShipping(gross) > 0
                  ? `faltam ${brl(missingForFreeShipping(gross))} para ganhar frete grátis`
                  : "você ganhou frete grátis"}
              </p>
              {cfg?.sandbox && (
                <p
                  role="note"
                  className="mt-3 rounded-lg border border-foreground bg-muted p-3 text-body"
                >
                  <b>Ambiente de testes.</b> Nenhuma cobrança real será feita.
                </p>
              )}
            </div>

            <section className={panel} aria-label="Quem já usa Vonix">
              <p className="mb-2 text-small font-semibold">Quem já usa Vonix: afiliadas e embaixadoras. Toque para assistir.</p>
              <ProvasEmVideo all />
            </section>

            <fieldset className={panel}>
              <StepTitle n={1}>Contato</StepTitle>
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
              <div className="grid grid-cols-2 gap-2">
<input
                required
                inputMode="tel"
                aria-label="WhatsApp com DDD"
                placeholder="WhatsApp com DDD"
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
              </fieldset>

            <fieldset className={panel}>
              <StepTitle n={2}>Entrega</StepTitle>
              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
<input
                required
                inputMode="numeric"
                aria-label="CEP"
                placeholder="CEP (00000-000)"
                value={f.cep}
                maxLength={9}
                onChange={(e) => {
                  const m = maskCep(e.target.value);
                  setF((old) => ({ ...old, cep: m }));
                }}
                autoComplete="postal-code"
                className={inp}
              />
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
</div>
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

              <div className="space-y-2 pt-2" aria-live="polite">
                {quoting && <p className="text-body text-muted-foreground">Calculando frete…</p>}
                {quoteErr && !quoting && (
                  <p role="alert" className="text-body text-destructive">
                    {quoteErr}
                  </p>
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
                          {o.company} {o.name}{" "}
                          <span className="text-muted-foreground">· até {o.days} dias úteis</span>
                        </span>
                      </span>
                      <b>{o.free ? "Grátis" : brl(o.price)}</b>
                    </label>
                  ))}
              </div>
            </fieldset>

            <fieldset className={panel}>
              <StepTitle n={3}>Pagamento</StepTitle>
              <label
                className={`flex items-center justify-between rounded-lg border-2 p-3.5 text-body ${pay === "pix" ? "border-action bg-card font-medium" : "border-border"}`}
              >
                <span className="flex gap-2">
                  <input
                    type="radio"
                    name="pay"
                    checked={pay === "pix"}
                    onChange={() => setPay("pix")}
                  />{" "}
                  Pix{" "}
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase text-white">economize {brl(tPix.pixDiscount)}</span>
                </span>
                <b>{brl(tPix.net + shipping)}</b>
              </label>
              <label
                className={`flex items-center justify-between rounded-lg border-2 p-3.5 text-body ${pay === "card" ? "border-action bg-card font-medium" : "border-border"}`}
              >
                <span className="flex gap-2">
                  <input
                    type="radio"
                    name="pay"
                    checked={pay === "card"}
                    onChange={() => setPay("card")}
                  />{" "}
                  Cartão de crédito · até 6x sem juros
                </span>
                <b>{brl(tCard.net + shipping)}</b>
              </label>
              {!showCoupon ? (
                <button
                  type="button"
                  onClick={() => setShowCoupon(true)}
                  className="text-body underline"
                >
                  Tem um cupom?
                </button>
              ) : (
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
            </fieldset>
          </form>

          {/* Card fields live in their own form so Appmax JS can tokenize them; the main form triggers it. */}
          <div>
            <form
              id="card-form"
              data-appmax-checkout
              hidden={pay !== "card"}
              className={`min-w-0 ${panel}`}
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="text-name font-semibold">Dados do cartão</div>
              <input
                form="card-form"
                required
                name="card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="Número do cartão"
                value={card.number}
                onChange={(e) =>
                  setCard((o) => ({
                    ...o,
                    number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23),
                  }))
                }
                className={inp}
              />
              <input
                form="card-form"
                required
                name="card-holder-name"
                autoComplete="cc-name"
                placeholder="Nome impresso no cartão"
                value={card.holder}
                onChange={(e) => setCard((o) => ({ ...o, holder: e.target.value }))}
                className={inp}
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  form="card-form"
                  required
                  name="exp-month"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  placeholder="Mês (MM)"
                  maxLength={2}
                  value={card.month}
                  onChange={(e) =>
                    setCard((o) => ({ ...o, month: e.target.value.replace(/\D/g, "") }))
                  }
                  className={inp}
                />
                <input
                  form="card-form"
                  required
                  name="exp-year"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  placeholder="Ano (AAAA)"
                  maxLength={4}
                  value={card.year}
                  onChange={(e) =>
                    setCard((o) => ({ ...o, year: e.target.value.replace(/\D/g, "") }))
                  }
                  className={inp}
                />
                <input
                  form="card-form"
                  required
                  name="cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="CVV"
                  maxLength={4}
                  value={card.cvv}
                  onChange={(e) =>
                    setCard((o) => ({ ...o, cvv: e.target.value.replace(/\D/g, "") }))
                  }
                  className={inp}
                />
              </div>
              <select
                aria-label="Parcelas"
                value={parcels}
                onChange={(e) => setParcels(Number(e.target.value))}
                className={inp}
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
        </div>

        <aside
          className="h-fit min-w-0 space-y-4 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 order-first lg:order-none lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 data-[lateral=true]:!static data-[lateral=true]:!col-start-1 data-[lateral=true]:!row-start-auto"
          aria-label="Resumo do pedido"
          data-lateral={lateral}
        >
          <ul className="space-y-2 text-body">
            {c.lines.map((l) => (
              <li
                key={l.slug + l.variant + (l.offer ?? "")}
                className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-2"
              >
                <img
                  src={l.product.images[0]}
                  alt={l.product.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded border border-border bg-background object-contain"
                />
                <span className="min-w-0 break-words">
                  {l.units}× {l.product.name}{" "}
                  <span className="text-muted-foreground">({l.variant})</span>
                </span>
                <span className="whitespace-nowrap font-medium">{brl(l.net)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-body" data-testid="summary">
            <div className="flex justify-between">
              <span>Subtotal dos produtos</span>
              <span>{brl(t.gross)}</span>
            </div>
            {t.offerDiscount > 0 && (
              <div className="flex justify-between">
                <span>Economia das ofertas</span>
                <span>− {brl(t.offerDiscount)}</span>
              </div>
            )}
            {t.couponDiscount > 0 && applied && (
              <div className="flex justify-between">
                <span>Cupom {applied.code}</span>
                <span>− {brl(t.couponDiscount)}</span>
              </div>
            )}
            {t.pixDiscount > 0 && (
              <div className="flex justify-between">
                <span>Desconto Pix</span>
                <span>− {brl(t.pixDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Frete</span>
              <span>{chosen ? (chosen.free ? "Grátis" : brl(chosen.price)) : "Informe o CEP"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-body font-semibold">
              <span>
                Total {pay === "pix" ? "no Pix" : "no cartão"}
                {chosen ? "" : " (sem frete)"}
              </span>
              <span>{brl(total)}</span>
            </div>
            {pay === "card" && (
              <div className="text-muted-foreground">
                até 6x de {brl(inst.value)} sem juros
                {inst.first !== inst.value ? ` (1ª de ${brl(inst.first)})` : ""}
              </div>
            )}
          </div>
        </aside>
        <div className="min-w-0 space-y-4 lg:col-start-1">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-3 text-body text-destructive"
            >
              {error}
            </p>
          )}
          {cfg && !cfg.pixEnabled && (
            <p role="status" className="rounded-lg border border-border bg-muted p-3 text-body">
              Estamos ativando os pagamentos desta loja. Em breve você poderá finalizar por aqui.
              Para comprar agora,{" "}
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">
                fale com a gente no WhatsApp
              </a>
              .
            </p>
          )}
          <div className="sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {!chosen && !quoting && (
              <p className="text-center text-small text-muted-foreground">
                Digite o CEP para liberar o pagamento
              </p>
            )}
            <button
              type="submit"
              form="checkout-form"
              disabled={busy || quoting || !chosen || !cfg || !cfg.pixEnabled}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 font-bold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.99] py-4 text-name disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-900/60 disabled:shadow-none"
            >
              <Lock className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
              {busy
                ? "Processando…"
                : pay === "pix"
                  ? `Gerar Pix · ${brl(total)}`
                  : `Pagar ${brl(total)} no cartão`}
            </button>
          </div>
          <div className="flex justify-center">
            <SecuritySeal />
          </div>
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
