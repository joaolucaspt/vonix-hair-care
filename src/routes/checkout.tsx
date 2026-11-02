import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SecuritySeal, Shell } from "@/components/site";
import { ShippingBar } from "@/components/cart-summary";
import { toItem, track } from "@/lib/analytics";
import { isValidCpf } from "@/lib/cpf";
import { createPayment, getOrderStatus, getPaymentConfig, quoteShipping } from "@/lib/checkout.functions";
import { OFFER_LABEL, WHATSAPP, brl, checkoutTotals, getSavedCep, installments, maskCep, saveCep, useCart, useHydrated } from "@/lib/store";
import { couponCheck, couponPercent, findCoupon, getPrize, type Coupon } from "@/lib/coupons";

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

const inp = "h-11 w-full rounded-lg border border-border bg-background px-3 text-body";

const maskCpf = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");

type ShipOption = { id: number; name: string; company: string; price: number; days: number; free: boolean };
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

function PixPanel({ pix, paid, onCopy, copied, onRestart }: { pix: PixResult; paid: boolean; onCopy: () => void; copied: boolean; onRestart: () => void }) {
  const [left, setLeft] = useState(() => parseExpiry(pix.expiresAt) - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(parseExpiry(pix.expiresAt) - Date.now()), 1000);
    return () => clearInterval(t);
  }, [pix.expiresAt]);
  if (paid)
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-h1">Pagamento confirmado!</h1>
        <p className="mt-2 text-body text-muted-foreground">Pedido nº {pix.orderId}. Você receberá os detalhes por e-mail e WhatsApp.</p>
        <Link to="/loja" className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground">Continuar comprando</Link>
      </div>
    );
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <h1 className="font-display text-h1">Pague com Pix</h1>
      <p className="mt-2 text-body text-muted-foreground">Pedido nº {pix.orderId} · {brl(pix.total)}</p>
      <img src={`data:image/png;base64,${pix.qrcode}`} alt="QR Code do Pix" width={220} height={220} className="mx-auto mt-4 h-[220px] w-[220px]" />
      <p className="mt-4 text-body">Abra o app do seu banco, escolha Pix e leia o QR Code, ou copie o código abaixo.</p>
      <textarea readOnly value={pix.emv} rows={3} className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-small" onFocus={(e) => e.currentTarget.select()} />
      {left > 0 ? (
        <button type="button" onClick={onCopy} className="mt-3 w-full rounded-full bg-action py-3 font-medium text-action-foreground">
          {copied ? "Código copiado!" : "Copiar código Pix"}
        </button>
      ) : (
        <button type="button" onClick={onRestart} className="mt-3 w-full rounded-full bg-action py-3 font-medium text-action-foreground">
          Gerar um novo Pix
        </button>
      )}
      <p className="mt-3 text-body text-muted-foreground">
        {left > 0 ? `Expira em ${mm}:${String(ss).padStart(2, "0")}. ` : "Este Pix expirou. Volte e gere outro. "}Aguardando pagamento — esta tela atualiza sozinha.
      </p>
    </div>
  );
}

function Checkout() {
  const c = useCart();
  const hydrated = useHydrated();
  const [f, setF] = useState({ nome: "", email: "", cpf: "", whatsapp: "", cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const lastCep = useRef("");
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
  const [cfg, setCfg] = useState<{ externalId: string; sandbox: boolean } | null>(null);
  const ip = useRef("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((old) => ({ ...old, [k]: e.target.value }));

  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setF((old) => (old.cep ? old : { ...old, cep: saved }));
    getPaymentConfig().then(setCfg).catch(() => setCfg({ externalId: "", sandbox: true }));
    // A coupon won on the prize wheel is applied automatically.
    const prize = getPrize();
    if (prize) {
      setApplied(prize);
      setShowCoupon(true);
      setCoupon(prize.code);
      setCouponMsg(`Cupom ${prize.code} aplicado: ${prize.label}.`);
    }
  }, []);

  const hasLines = c.lines.length > 0;
  useEffect(() => {
    if (hasLines) track("begin_checkout", { value: c.netSubtotal, items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)) });
  }, [hasLines]);

  const items = c.lines.map((l) => ({ slug: l.slug, variant: l.variant, qty: l.qty, ...(l.offer ? { offer: l.offer } : {}) }));
  const itemsKey = JSON.stringify(items);

  // Shipping quote (Melhor Envio) whenever a full CEP or the cart changes.
  useEffect(() => {
    const d = f.cep.replace(/\D/g, "");
    if (d.length !== 8 || !items.length) return;
    let cancelled = false;
    setQuoting(true);
    setQuoteErr(null);
    quoteShipping({ data: { cep: d, items, ...(applied ? { coupon: applied.code } : {}) } })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setOptions(r.options);
          setServiceId((cur) => (r.options.some((o) => o.id === cur) ? cur : (r.options[0]?.id ?? null)));
          if (!r.options.length) setQuoteErr("Nenhuma transportadora atende este CEP. Fale com a gente no WhatsApp.");
        } else {
          setOptions([]);
          setServiceId(null);
          setQuoteErr(r.message);
        }
      })
      .catch(() => !cancelled && setQuoteErr("Não foi possível calcular o frete agora. Tente novamente."))
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
  const shipping = chosen ? chosen.price : 0;
  const total = t.net + shipping;

  const lookup = async (v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length !== 8 || d === lastCep.current) return;
    lastCep.current = d;
    setCepLoading(true);
    setCepMsg(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal }).then((x) => x.json());
      if (r.erro) {
        setCepMsg("CEP não encontrado. Preencha o endereço manualmente.");
      } else {
        setF((old) => ({ ...old, rua: r.logradouro ?? "", bairro: r.bairro ?? "", cidade: r.localidade ?? "", uf: r.uf ?? "" }));
        saveCep(v);
        setCepMsg("Endereço preenchido — confira e complete o número.");
        numeroRef.current?.focus();
      }
    } catch {
      lastCep.current = "";
      setCepMsg("A consulta do CEP demorou ou falhou. Preencha o endereço manualmente.");
    } finally {
      clearTimeout(timer);
      setCepLoading(false);
    }
  };

  const applyCoupon = () => {
    if (!coupon.trim()) return setCouponMsg("Digite um código de cupom.");
    const found = findCoupon(coupon);
    if (!found) return setCouponMsg("Cupom não encontrado. Confira o código.");
    const chk = couponCheck(found, gross);
    setApplied(found);
    setCouponMsg(chk.ok ? `Cupom ${found.code} aplicado: ${found.label}.` : chk.reason);
  };

  const finish = (orderId: number, value: number) => {
    track("purchase", { transaction_id: String(orderId), value, shipping, items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)) });
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
          address: { cep: f.cep, rua: f.rua, numero: f.numero, complemento: f.complemento, bairro: f.bairro, cidade: f.cidade, uf: f.uf },
          items,
          serviceId: chosen.id,
          method: pay,
          ...(applied ? { coupon: applied.code } : {}),
          ...(ip.current ? { ip: ip.current } : {}),
          ...(token ? { token, holderName: card.holder, installments: parcels } : {}),
        },
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (r.method === "pix") {
        setPix({ orderId: r.orderId, total: r.total, emv: r.pix.emv, qrcode: r.pix.qrcode, expiresAt: r.pix.expiresAt });
        window.scrollTo({ top: 0 });
      } else {
        setCardDone({ orderId: r.orderId, paid: r.paid });
        if (r.paid) finish(r.orderId, r.total);
        else setError("Pagamento em análise ou não aprovado. Confira com seu banco ou tente outro cartão ou o Pix.");
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
    s.src = cfg.sandbox ? "https://scripts.sandboxappmax.com.br/appmax.min.js" : "https://scripts.appmax.com.br/appmax.min.js";
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
      setBusy(true);
      setError(null);
      (document.getElementById("card-form") as HTMLFormElement | null)?.requestSubmit();
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
              navigator.clipboard?.writeText(pix.emv).then(() => setCopied(true)).catch(() => undefined);
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
          <p className="mt-2 text-body text-muted-foreground">Pedido nº {cardDone.orderId}. Você receberá os detalhes por e-mail e WhatsApp.</p>
          <Link to="/loja" className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground">Continuar comprando</Link>
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
          <Link to="/loja" className="mt-4 inline-block underline">Ver produtos</Link>
        </div>
      </Shell>
    );

  const inst = installments(total);

  return (
    <Shell>
      <div className="container-site grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form className="min-w-0 space-y-8" onSubmit={onSubmit}>
          <div>
            <h1 className="font-display text-h1">Finalizar compra</h1>
            <p className="mt-2 text-body text-muted-foreground"><b>Compre sem criar uma conta.</b> Login é opcional e não é pedido em nenhuma etapa.</p>
            {cfg?.sandbox && <p role="note" className="mt-3 rounded-lg border border-foreground bg-muted p-3 text-body"><b>Ambiente de testes.</b> Nenhuma cobrança real será feita.</p>}
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-name font-semibold">1. Contato</legend>
            <input required aria-label="Nome completo" placeholder="Nome completo" value={f.nome} onChange={set("nome")} autoComplete="name" className={inp} />
            <input required type="email" inputMode="email" aria-label="E-mail" placeholder="E-mail" value={f.email} onChange={set("email")} autoComplete="email" className={inp} />
            <input required inputMode="tel" aria-label="WhatsApp com DDD" placeholder="WhatsApp com DDD" value={f.whatsapp} onChange={set("whatsapp")} autoComplete="tel" className={inp} />
            <input required inputMode="numeric" aria-label="CPF" placeholder="CPF (necessário para emissão da nota fiscal)" value={f.cpf} maxLength={14} onChange={(e) => setF((old) => ({ ...old, cpf: maskCpf(e.target.value) }))} className={inp} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-name font-semibold">2. Entrega</legend>
            <input required inputMode="numeric" aria-label="CEP" placeholder="CEP (00000-000)" value={f.cep} maxLength={9} onChange={(e) => { const m = maskCep(e.target.value); setF((old) => ({ ...old, cep: m })); lookup(m); }} autoComplete="postal-code" className={inp} />
            {cepLoading && <p role="status" className="text-body text-muted-foreground">Buscando endereço…</p>}
            {cepMsg && !cepLoading && <p role="status" className="text-body text-muted-foreground">{cepMsg}</p>}
            <input required aria-label="Rua" placeholder="Rua" value={f.rua} onChange={set("rua")} autoComplete="address-line1" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <input ref={numeroRef} required inputMode="numeric" aria-label="Número" placeholder="Número" value={f.numero} onChange={set("numero")} autoComplete="off" className={inp} />
              <input aria-label="Complemento" placeholder="Complemento (opcional)" value={f.complemento} onChange={set("complemento")} autoComplete="address-line2" className={inp} />
            </div>
            <input required aria-label="Bairro" placeholder="Bairro" value={f.bairro} onChange={set("bairro")} autoComplete="address-level3" className={inp} />
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <input required aria-label="Cidade" placeholder="Cidade" value={f.cidade} onChange={set("cidade")} autoComplete="address-level2" className={inp} />
              <input required aria-label="UF" placeholder="UF" value={f.uf} onChange={set("uf")} maxLength={2} autoComplete="address-level1" className={inp} />
            </div>

            <div className="space-y-2 pt-2" aria-live="polite">
              <div className="text-body font-medium">Forma de entrega</div>
              {quoting && <p className="text-body text-muted-foreground">Calculando frete…</p>}
              {quoteErr && !quoting && <p role="alert" className="text-body text-destructive">{quoteErr}</p>}
              {!quoting && !quoteErr && !options.length && <p className="text-body text-muted-foreground">Informe o CEP para ver as opções de entrega.</p>}
              {!quoting && options.map((o) => (
                <label key={o.id} className={`flex items-center justify-between rounded-lg border p-3 text-body ${serviceId === o.id ? "border-action bg-card font-medium" : "border-border"}`}>
                  <span className="flex gap-2">
                    <input type="radio" name="frete" checked={serviceId === o.id} onChange={() => setServiceId(o.id)} />
                    <span>{o.company} {o.name} <span className="text-muted-foreground">· até {o.days} dias úteis</span></span>
                  </span>
                  <b>{o.free ? "Grátis" : brl(o.price)}</b>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-name font-semibold">3. Pagamento</legend>
            <label className={`flex items-center justify-between rounded-lg border p-3 text-body ${pay === "pix" ? "border-action bg-card font-medium" : "border-border"}`}>
              <span className="flex gap-2"><input type="radio" name="pay" checked={pay === "pix"} onChange={() => setPay("pix")} /> Pix (5% de desconto nos itens sem outra oferta)</span>
              <b>{brl(tPix.net + shipping)}</b>
            </label>
            <label className={`flex items-center justify-between rounded-lg border p-3 text-body ${pay === "card" ? "border-action bg-card font-medium" : "border-border"}`}>
              <span className="flex gap-2"><input type="radio" name="pay" checked={pay === "card"} onChange={() => setPay("card")} /> Cartão de crédito — até 6x sem juros</span>
              <b>{brl(tCard.net + shipping)}</b>
            </label>
            {!showCoupon ? (
              <button type="button" onClick={() => setShowCoupon(true)} className="text-body underline">Tem um cupom?</button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input aria-label="Código do cupom" placeholder="Código do cupom" value={coupon} onChange={(e) => setCoupon(e.target.value)} className={inp} />
                  <button type="button" onClick={applyCoupon} className="shrink-0 rounded-lg border border-foreground px-4 text-body">Aplicar</button>
                  <button type="button" aria-label="Remover cupom" onClick={() => { setShowCoupon(false); setCoupon(""); setCouponMsg(null); setApplied(null); }} className="shrink-0 text-body underline">Remover</button>
                </div>
                {couponMsg && <p role="alert" className="text-body text-muted-foreground">{couponMsg}</p>}
              </div>
            )}
          </fieldset>

          {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-body text-destructive">{error}</p>}
          <button disabled={busy || !chosen} className="w-full rounded-full bg-action py-3.5 font-medium text-action-foreground disabled:opacity-60">
            {busy ? "Processando…" : pay === "pix" ? `Gerar Pix · ${brl(total)}` : `Pagar ${brl(total)} no cartão`}
          </button>
          <div className="flex justify-center"><SecuritySeal /></div>
          {!chosen && <p className="text-center text-body text-muted-foreground">Informe o CEP e escolha a entrega para continuar.</p>}
          <p className="text-center text-body text-muted-foreground">
            Precisa de ajuda para finalizar? <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">Fale com a gente no WhatsApp</a>
          </p>
        </form>

        {/* Card fields live in their own form so Appmax JS can tokenize them; the main form triggers it. */}
        <div className="lg:col-start-1 lg:row-start-2">
          <form id="card-form" data-appmax-checkout hidden={pay !== "card"} className="min-w-0 space-y-3" onSubmit={(e) => e.preventDefault()}>
            <div className="text-name font-semibold">Dados do cartão</div>
            <input form="card-form" required name="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="Número do cartão" value={card.number} onChange={(e) => setCard((o) => ({ ...o, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) }))} className={inp} />
            <input form="card-form" required name="card-holder-name" autoComplete="cc-name" placeholder="Nome impresso no cartão" value={card.holder} onChange={(e) => setCard((o) => ({ ...o, holder: e.target.value }))} className={inp} />
            <div className="grid grid-cols-3 gap-3">
              <input form="card-form" required name="exp-month" inputMode="numeric" autoComplete="cc-exp-month" placeholder="Mês (MM)" maxLength={2} value={card.month} onChange={(e) => setCard((o) => ({ ...o, month: e.target.value.replace(/\D/g, "") }))} className={inp} />
              <input form="card-form" required name="exp-year" inputMode="numeric" autoComplete="cc-exp-year" placeholder="Ano (AAAA)" maxLength={4} value={card.year} onChange={(e) => setCard((o) => ({ ...o, year: e.target.value.replace(/\D/g, "") }))} className={inp} />
              <input form="card-form" required name="cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" maxLength={4} value={card.cvv} onChange={(e) => setCard((o) => ({ ...o, cvv: e.target.value.replace(/\D/g, "") }))} className={inp} />
            </div>
            <select aria-label="Parcelas" value={parcels} onChange={(e) => setParcels(Number(e.target.value))} className={inp}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}x de {brl(installments(total, n).value)} sem juros</option>
              ))}
            </select>
          </form>
          <form data-appmax-customer hidden />
        </div>

        <aside className="min-w-0 space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2" aria-label="Resumo do pedido">
          <ShippingBar subtotal={c.subtotal} />
          <ul className="space-y-2 text-body">
            {c.lines.map((l) => (
              <li key={l.slug + l.variant + (l.offer ?? "")} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-2">
                <img src={l.product.images[0]} alt={l.product.name} width={48} height={48} className="h-12 w-12 rounded border border-border bg-background object-contain" />
                <span className="min-w-0 break-words">
                  {l.units}× {l.product.name} <span className="text-muted-foreground">({l.variant})</span>
                  {l.offer && <span className="block text-small text-muted-foreground">{OFFER_LABEL[l.offer]}{l.offer !== "comp5" ? ` · ${l.qty} combo(s)` : ""}</span>}
                </span>
                <span className="whitespace-nowrap font-medium">{brl(l.net)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 text-body" data-testid="summary">
            <div className="flex justify-between"><span>Subtotal dos produtos</span><span>{brl(t.gross)}</span></div>
            {t.offerDiscount > 0 && <div className="flex justify-between"><span>Economia das ofertas</span><span>− {brl(t.offerDiscount)}</span></div>}
            {t.couponDiscount > 0 && applied && <div className="flex justify-between"><span>Cupom {applied.code}</span><span>− {brl(t.couponDiscount)}</span></div>}
            {t.pixDiscount > 0 && <div className="flex justify-between"><span>Desconto Pix (5% nos itens sem oferta)</span><span>− {brl(t.pixDiscount)}</span></div>}
            {t.hasOffers && <p className="text-small text-muted-foreground">Ofertas não cumulativas no mesmo item.</p>}
            <div className="flex justify-between"><span>Frete</span><span>{chosen ? (chosen.free ? "Grátis" : brl(chosen.price)) : "Informe o CEP"}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-body font-semibold"><span>Total {pay === "pix" ? "no Pix" : "no cartão"}{chosen ? "" : " (sem frete)"}</span><span>{brl(total)}</span></div>
            {pay === "card" && <div className="text-muted-foreground">até 6x de {brl(inst.value)} sem juros{inst.first !== inst.value ? ` (1ª de ${brl(inst.first)})` : ""}</div>}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
