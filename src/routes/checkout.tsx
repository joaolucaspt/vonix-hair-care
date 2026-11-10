import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearPendingCard,
  restorePendingCard,
  savePendingCard,
  pendingPaymentFromResponse,
  type PendingCard,
} from "@/lib/pending-card";
import { clearPendingPix, restorePendingPix, savePendingPix } from "@/lib/pending-pix";
import {
  clearPurchaseBasket,
  matchesPurchaseBasket,
  restorePurchaseBasket,
  savePurchaseBasket,
} from "@/lib/pending-purchase-basket";
import {
  rememberPaymentAttempt,
  recoverUncertainPayment,
  clearUncertainPayment,
} from "@/lib/uncertain-payment";
import { isTerminatedOrder } from "@/lib/order-events";
import { Lock } from "lucide-react";
import { SecuritySeal, Shell } from "@/components/site";
import { ShippingBar } from "@/components/cart-summary";
import { useCepAddress } from "@/hooks/use-cep-address";
import { toItem, track } from "@/lib/analytics";
import { hasTrackingConsent } from "@/lib/tracking-consent";
import { isValidCpf } from "@/lib/cpf";
import {
  hasDeliveryAddress,
  isValidBrazilUF,
  isValidBrazilWhatsapp,
} from "@/lib/checkout-input-validation";
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
  saveCep,
  useCart,
  useHydrated,
} from "@/lib/store";
import {
  couponCheck,
  couponPercent,
  findCoupon,
  getPrize,
  isAffiliateCouponCode,
  type Coupon,
} from "@/lib/coupons";

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
  "h-12 w-full rounded-xl border border-border bg-white px-3.5 text-body outline-none transition focus:border-action focus:ring-2 focus:ring-action/40";

const panel = "space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5";

const StepTitle = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <legend className="mb-1 flex items-center gap-2 text-name font-semibold">
    <span className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-small font-semibold text-background">
      {n}
    </span>
    {children}
  </legend>
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
type PixResult = {
  orderId: number;
  statusToken: string;
  total: number;
  emv: string;
  qrcode: string;
  expiresAt: string;
};

declare global {
  interface Window {
    AppmaxScripts?: {
      init: (o: {
        externalId?: string;

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
  canRestart,
}: {
  pix: PixResult;
  paid: boolean;
  onCopy: () => void;
  copied: boolean;
  onRestart: () => void;
  canRestart: boolean;
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
          Pedido nº {pix.orderId}. Guarde este número para acompanhar seu pedido pela área Meus
          pedidos ou pelo atendimento.
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
          disabled={!canRestart}
          className="mt-3 w-full rounded-full bg-action py-3 font-medium text-action-foreground"
        >
          {canRestart ? "Gerar um novo Pix" : "Verificando o Pix anterior..."}
        </button>
      )}
      <p className="mt-3 text-body text-muted-foreground">
        {left > 0
          ? `Expira em ${mm}:${String(ss).padStart(2, "0")}. `
          : "O prazo do QR Code terminou. Antes de gerar outro Pix, precisamos confirmar o cancelamento deste pedido. "}
        {left > 0
          ? "Aguardando pagamento — esta tela atualiza sozinha."
          : "A consulta de status continua automaticamente."}
      </p>
    </div>
  );
}

function Checkout() {
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
  const cpfRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const ufRef = useRef<HTMLInputElement>(null);
  const [cpfInvalid, setCpfInvalid] = useState(false);
  const [pay, setPay] = useState<"pix" | "card">("pix");
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const couponLookupSequence = useRef(0);
  const couponEdited = useRef(false);
  const checkoutSubmissionStarted = useRef(false);
  const [applied, setApplied] = useState<Coupon | null>(null);
  const [options, setOptions] = useState<ShipOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [quoteRetry, setQuoteRetry] = useState(0);
  // The last successful shipping response is valid only for the exact
  // CEP, basket, coupon and retry cycle that produced it.
  const [quotedRequestKey, setQuotedRequestKey] = useState<string | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [card, setCard] = useState({ number: "", holder: "", month: "", year: "", cvv: "" });
  const [parcels, setParcels] = useState(1);
  const [busy, setBusy] = useState(false);
  const [cardSdkState, setCardSdkState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [cardSdkRetry, setCardSdkRetry] = useState(0);
  const paymentInFlight = useRef(false);
  const cardTokenizationPending = useRef(false);
  const cardTokenizationTimer = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [paid, setPaid] = useState(false);
  const [pixRetryVerified, setPixRetryVerified] = useState<number | null>(null);
  const [cardRetryVerified, setCardRetryVerified] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [cardDone, setCardDone] = useState<PendingCard | null>(null);
  const [paymentRecoveryRequired, setPaymentRecoveryRequired] = useState(false);
  const [cfg, setCfg] = useState<{
    externalId: string;
    sandbox: boolean;
    pixEnabled?: boolean;
    cardEnabled?: boolean;
  } | null>(null);
  const [configRetry, setConfigRetry] = useState(0);
  const [configLookupFailed, setConfigLookupFailed] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((old) => ({ ...old, [k]: e.target.value }));

  useEffect(() => {
    const saved = getSavedCep();
    if (saved) setF((old) => (old.cep ? old : { ...old, cep: saved }));
    // Payment readiness has its own retryable effect; a retry must not reapply
    // a prize or overwrite the discount a buyer already chose.
    // A coupon won on the prize wheel is applied automatically.
    const prize = getPrize();
    if (prize) {
      setApplied(prize);
      setShowCoupon(true);
      setCoupon(prize.code);
      setCouponMsg(
        `Cupom ${prize.code} disponível. O desconto será calculado apenas nos itens sem outra oferta.`,
      );
    }
    // A referral discount is not trusted until the server verifies its coupon.
    // Never override a prize-wheel coupon or a code the buyer typed manually.
    const ref = getRef();
    if (ref && !prize) {
      const code = `${ref.toUpperCase()}10`;
      lookupCoupon({ data: { code } })
        .then((resolved) => {
          // Never alter a payment amount after the customer has submitted.
          if (!resolved.ok || couponEdited.current || checkoutSubmissionStarted.current) return;
          setApplied({ code: resolved.code, label: resolved.label, percent: resolved.percent });
          setCoupon(resolved.code);
          setShowCoupon(true);
          setCouponMsg(
            `Cupom ${resolved.code} confirmado. O desconto só vale para itens sem outra oferta.`,
          );
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    // A slow or failed configuration request must not leave an apparently
    // payable checkout collecting customer/card details indefinitely.
    let active = true;
    const unavailable = {
      externalId: "",
      sandbox: true,
      pixEnabled: false,
      cardEnabled: false,
    };
    const watchdog = window.setTimeout(() => {
      if (!active) return;
      // A response arriving after the deadline must not silently re-open a
      // checkout that told the customer the provider could not be verified.
      active = false;
      setConfigLookupFailed(true);
      setCfg(unavailable);
    }, 12000);
    void getPaymentConfig().then(
      (config) => {
        if (!active) return;
        window.clearTimeout(watchdog);
        setConfigLookupFailed(false);
        setCfg(config);
      },
      () => {
        if (!active) return;
        window.clearTimeout(watchdog);
        setConfigLookupFailed(true);
        setCfg(unavailable);
      },
    );
    return () => {
      active = false;
      window.clearTimeout(watchdog);
    };
  }, [configRetry]);

  // Reattach a pending authorization after a refresh without recharging.
  useEffect(() => {
    const pending = restorePendingCard();
    // Never trust paid=true from tab storage: it can be edited by the buyer.
    // Resume the same order without permitting any new charge, and require a
    // fresh authenticated status response before displaying "paid".
    if (pending) setCardDone({ ...pending, paid: false });
    else {
      const pendingPix = restorePendingPix();
      if (pendingPix) setPix(pendingPix);
    }
  }, []);

  const hasLines = c.lines.length > 0;
  // Recover uncertain payment attempts after reload; the marker has no customer PII.
  useEffect(() => {
    if (recoverUncertainPayment()) setPaymentRecoveryRequired(true);
  }, []);

  // A disabled method can stop conversion before the buyer ever clicks Pay.
  // Record availability without sending customer, address or card fields.
  useEffect(() => {
    if (!cfg || !hasLines) return;
    if (!cfg.pixEnabled)
      track("checkout_error", { step: "payment_config", reason: "pix_unavailable" });
    if (!cfg.cardEnabled)
      track("checkout_error", { step: "payment_config", reason: "card_unavailable" });
  }, [cfg, hasLines]);
  // Prefer an actually available method; never leave a buyer on an unavailable default.
  // This changes presentation only and does not start tokenization or payment by itself.
  useEffect(() => {
    if (!cfg) return;
    setPay((current) => {
      if (current === "pix" && !cfg.pixEnabled && cfg.cardEnabled) return "card";
      if (current === "card" && !cfg.cardEnabled && cfg.pixEnabled) return "pix";
      return current;
    });
  }, [cfg]);
  const beginCheckoutTracked = useRef(false);
  useEffect(() => {
    if (hasLines && !beginCheckoutTracked.current) {
      beginCheckoutTracked.current = true;
      track("begin_checkout", {
        value: c.netSubtotal,
        items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)),
      });
    }
  }, [hasLines, c.lines, c.netSubtotal]);

  const items = c.lines.map((l) => ({
    slug: l.slug,
    variant: l.variant,
    qty: l.qty,
    ...(l.offer ? { offer: l.offer } : {}),
  }));
  const itemsKey = JSON.stringify(items);
  const appliedCode = applied?.code;
  const shippingRequestKey = JSON.stringify([
    f.cep.replace(/\D/g, ""),
    itemsKey,
    appliedCode ?? null,
    quoteRetry,
  ]);
  const addressFilled = useCallback(
    (
      address: { street: string; district: string; city: string; uf: string },
      lookedUpCep: string,
    ) => {
      setF((old) => {
        // A late lookup must never fill a different delivery CEP. Preserve
        // fields typed by the buyer after the request started.
        if (old.cep.replace(/\D/g, "") !== lookedUpCep) return old;
        return {
          ...old,
          rua: old.rua.trim() ? old.rua : address.street,
          bairro: old.bairro.trim() ? old.bairro : address.district,
          cidade: old.cidade.trim() ? old.cidade : address.city,
          uf: old.uf.trim() ? old.uf : address.uf,
        };
      });
      // A city-wide CEP may not include a street or district. Guide the buyer
      // to the first missing field instead of prematurely focusing the house number.
      if (!streetRef.current?.value.trim() && !address.street.trim()) streetRef.current?.focus();
      else if (!districtRef.current?.value.trim() && !address.district.trim())
        districtRef.current?.focus();
      else if (!numeroRef.current?.value.trim()) numeroRef.current?.focus();
    },
    [],
  );
  const {
    loading: cepLoading,
    message: cepMsg,
    failed: cepLookupFailed,
    retry: retryCepLookup,
  } = useCepAddress(f.cep, addressFilled);

  // Shipping quote (Melhor Envio) whenever a full CEP or the cart changes.
  useEffect(() => {
    const quoteItems = JSON.parse(itemsKey) as typeof items;
    const d = f.cep.replace(/\D/g, "");
    setOptions([]);
    setServiceId(null);
    setQuotedRequestKey(null);
    setQuoteErr(null);
    if (d.length !== 8 || !quoteItems.length) {
      setQuoting(false);
      return;
    }
    saveCep(f.cep);
    let cancelled = false;
    // A carrier outage must never leave the button spinning forever.
    // Late responses are ignored; only an explicit new quote may unlock pay.
    const deadline = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setOptions([]);
      setServiceId(null);
      setQuotedRequestKey(null);
      setQuoting(false);
      setQuoteErr("O cálculo de frete demorou demais. Tente calcular novamente.");
      track("checkout_error", { step: "shipping", reason: "quote_timeout" });
    }, 15000);
    setQuoting(true);
    setQuoteErr(null);
    quoteShipping({
      data: { cep: d, items: quoteItems, ...(appliedCode ? { coupon: appliedCode } : {}) },
    })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          if (!r.options.length)
            track("checkout_error", { step: "shipping", reason: "no_options" });
          setOptions(r.options);
          setQuotedRequestKey(r.options.length > 0 ? shippingRequestKey : null);
          setServiceId((cur) =>
            r.options.some((o) => o.id === cur) ? cur : (r.options[0]?.id ?? null),
          );
          if (!r.options.length)
            setQuoteErr(
              "Não encontramos entrega disponível para este CEP no momento. Confira o CEP ou fale com a gente no WhatsApp.",
            );
        } else {
          setOptions([]);
          setServiceId(null);
          setQuotedRequestKey(null);
          setQuoteErr(r.message);
          track("checkout_error", { step: "shipping", reason: "quote_rejected" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setQuotedRequestKey(null);
        setQuoteErr("Não foi possível calcular o frete agora. Tente novamente.");
        track("checkout_error", { step: "shipping", reason: "network_or_server" });
      })
      .finally(() => {
        window.clearTimeout(deadline);
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(deadline);
    };
  }, [f.cep, itemsKey, appliedCode, quoteRetry, shippingRequestKey]);

  const gross = checkoutTotals(c.lines, "card").gross;
  const pct = couponPercent(applied ?? undefined, gross);
  const t = checkoutTotals(c.lines, pay, pct);
  const tPix = checkoutTotals(c.lines, "pix", pct);
  const tCard = checkoutTotals(c.lines, "card", pct);
  const couponProblem = applied ? couponCheck(applied, gross) : null;
  const couponNoSavings = !!applied && couponProblem?.ok === true && tCard.couponDiscount <= 0;
  const shippingQuoteCurrent = quotedRequestKey === shippingRequestKey && !quoting;
  const chosen = shippingQuoteCurrent ? (options.find((o) => o.id === serviceId) ?? null) : null;
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
    const sequence = ++couponLookupSequence.current;
    couponEdited.current = true;
    // A previous remote lookup may still be pending when the buyer types a
    // local coupon. It must not keep the payment button blocked indefinitely.
    setCouponChecking(false);
    const code = coupon.trim().toUpperCase();
    if (!code) return setCouponMsg("Digite um código de cupom.");
    let found = findCoupon(code);
    if (!found && isAffiliateCouponCode(code)) {
      setCouponChecking(true);
      setCouponMsg("Conferindo cupom de afiliada…");
      try {
        const verified = await lookupCoupon({ data: { code } });
        if (sequence !== couponLookupSequence.current) return;
        if (verified.ok)
          found = { code: verified.code, label: verified.label, percent: verified.percent };
      } catch {
        // Failure to verify is not permission to apply the promotion.
      } finally {
        if (sequence === couponLookupSequence.current) setCouponChecking(false);
      }
    }
    if (sequence !== couponLookupSequence.current) return;
    if (!found) return setCouponMsg("Cupom não encontrado. Confira o código.");
    const chk = couponCheck(found, gross);
    if (!chk.ok) {
      setApplied(null);
      setCouponMsg(chk.reason);
      return;
    }
    const saving = checkoutTotals(c.lines, "card", couponPercent(found, gross)).couponDiscount;
    if (saving <= 0) {
      setApplied(null);
      setCouponMsg(
        "Os produtos deste carrinho já têm outra promoção. O cupom vale somente para itens sem desconto de quantidade ou outra oferta.",
      );
      return;
    }
    setApplied(found);
    setCouponMsg(
      `Cupom ${found.code} aplicado aos itens elegíveis: você economiza ${brl(saving)}.`,
    );
  };

  const finishedOrders = useRef(new Set<number>());
  const finish = (orderId: number, value: number) => {
    if (finishedOrders.current.has(orderId)) return;
    finishedOrders.current.add(orderId);
    // A pending Pix/card can be confirmed after the buyer has shopped again
    // (including another tab or a reload). Never delete unrelated cart items
    // or attribute new SKUs to the old order's Purchase event.
    const sameBasket = matchesPurchaseBasket(c.lines, restorePurchaseBasket(orderId));
    track("purchase", {
      transaction_id: String(orderId),
      value,
      ...(sameBasket
        ? {
            shipping,
            items: c.lines.map((l) => toItem(l.product, l.variant, l.net / l.units, l.units)),
          }
        : {}),
    });
    if (sameBasket) c.clear();
    clearPurchaseBasket(orderId);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Pix: poll the order until Appmax reports it as paid.
  useEffect(() => {
    if (!pix || paid) return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const r = await getOrderStatus({
          data: { orderId: pix.orderId, statusToken: pix.statusToken },
        });
        if (disposed || !r.ok) return;
        if (r.paid) {
          clearPendingPix();
          setPaid(true);
          finishRef.current(pix.orderId, pix.total);
        } else {
          // Only an authoritative Appmax cancellation can unlock a new Pix.
          setPixRetryVerified(r.status === "cancelado" ? pix.orderId : null);
        }
      } catch {
        // Connection failures must not unlock another payment attempt.
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = setInterval(() => {
      void check();
    }, 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [pix, paid]);

  // Card authorization and antifraud checks are asynchronous. Poll the same
  // order instead of inviting a second payment while its status is uncertain.
  useEffect(() => {
    if (
      !cardDone ||
      cardDone.paid ||
      (isTerminatedOrder(cardDone.status) && cardRetryVerified === cardDone.orderId)
    )
      return;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await getOrderStatus({
          data: { orderId: cardDone.orderId, statusToken: cardDone.statusToken },
        });
        if (disposed || !result.ok) return;
        if (result.paid) {
          setCardRetryVerified(null);
          clearPendingCard();
          setCardDone((previous) =>
            previous?.orderId === cardDone.orderId
              ? { ...previous, paid: true, status: result.status }
              : previous,
          );
          finishRef.current(cardDone.orderId, cardDone.total);
        } else {
          // Restored sessionStorage may contain a forged or stale status.
          // Unlock a retry only after reading the final status from Appmax.
          setCardRetryVerified(isTerminatedOrder(result.status) ? cardDone.orderId : null);
          if (result.status !== cardDone.status) {
            savePendingCard({ ...cardDone, status: result.status });
            setCardDone((previous) =>
              previous?.orderId === cardDone.orderId
                ? { ...previous, status: result.status }
                : previous,
            );
          }
        }
      } catch {
        // A network error does not mean the card was declined.
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = setInterval(() => {
      void check();
    }, 5_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [cardDone, cardRetryVerified]);

  const submitPayment = async (token?: string) => {
    if (couponChecking) {
      setError("Aguarde a validação do cupom antes de iniciar o pagamento.");
      return;
    }
    if (!cfg || (pay === "pix" ? !cfg.pixEnabled : !cfg.cardEnabled)) {
      setError("Aguarde a verificação das formas de pagamento antes de continuar.");
      return;
    }
    if (!shippingQuoteCurrent || !chosen) {
      setError("O CEP ou a sacola mudou. Aguarde uma nova cotação de frete antes de pagar.");
      return;
    }
    if (paymentInFlight.current || cardDone || paymentRecoveryRequired) return;
    if (pay === "card" && cardSdkState !== "ready") {
      setError(
        "A validação segura do cartão não está pronta. Recarregue a validação ou escolha Pix.",
      );
      return;
    }
    paymentInFlight.current = true;
    setBusy(true);
    setError(null);
    // The request might reach Appmax even when the browser never sees a response.
    // Persist a tab-local guard BEFORE transmitting any payment data.
    rememberPaymentAttempt(pay);
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
          quotedTotalCents: Math.round(total * 100),
          method: pay,
          // The optional Meta Purchase event must follow consent at checkout.
          marketingConsent: hasTrackingConsent(),
          ...(applied ? { coupon: applied.code } : {}),

          ...(getRef() ? { ref: getRef() as string } : {}),
          ...(token ? { token, holderName: card.holder, installments: parcels } : {}),
        },
      });
      if (!r.ok) {
        track("checkout_error", {
          step: "payment",
          reason: "gateway_or_validation",
          payment_type: pay,
        });
        if ("retrySafe" in r && r.retrySafe === false) {
          setPaymentRecoveryRequired(true);
        } else {
          // Explicit rejection before payment is not a pending charge.
          clearUncertainPayment();
        }
        // A stale quote must be visibly refreshed before the next attempt.
        if ("reason" in r && r.reason === "price_changed") {
          setQuoteRetry((value) => value + 1);
        }
        setError(r.message);
        return;
      }
      // A "verification" response might point to an older reserved order;
      // never replace that order's basket with this new attempt's items.
      // A confirmed Pix/card creation can safely record its submitted basket,
      // without persisting any personal/card information or paid assertion.
      if (r.method !== "verification") savePurchaseBasket(r.orderId, items);
      if (r.method === "pix") {
        const pixResult = {
          orderId: r.orderId,
          statusToken: r.statusToken,
          total: r.total,
          emv: r.pix.emv,
          qrcode: r.pix.qrcode,
          expiresAt: r.pix.expiresAt,
        };
        savePendingPix(pixResult);
        setPix(pixResult);
        clearUncertainPayment();
        window.scrollTo({ top: 0 });
      } else {
        const cardResult = pendingPaymentFromResponse(r);
        if (r.paid) {
          clearPendingCard();
          finish(r.orderId, r.total);
        } else {
          savePendingCard(cardResult);
          if (isTerminatedOrder(cardResult.status)) setCardRetryVerified(cardResult.orderId);
        }
        setCardDone(cardResult);
        clearUncertainPayment();
      }
    } catch {
      track("checkout_error", { step: "payment", reason: "network_or_server", payment_type: pay });
      setPaymentRecoveryRequired(true);
      setError(
        "Não foi possível confirmar a resposta do pagamento. Não tente pagar novamente antes de consultar o atendimento.",
      );
    } finally {
      paymentInFlight.current = false;
      setBusy(false);
    }
  };
  const submitPaymentRef = useRef(submitPayment);
  submitPaymentRef.current = submitPayment;

  // Tokenization is a separate step: never charge if its SDK did not respond to this submit.
  useEffect(() => {
    if (!cfg?.externalId || !cfg?.cardEnabled) return;
    let active = true;
    setCardSdkState("loading");
    const s = document.createElement("script");
    s.src = cfg.sandbox
      ? "https://scripts.sandboxappmax.com.br/appmax.min.js"
      : "https://scripts.appmax.com.br/appmax.min.js";
    s.async = true;
    const clearTokenTimer = () => {
      if (cardTokenizationTimer.current !== null)
        window.clearTimeout(cardTokenizationTimer.current);
      cardTokenizationTimer.current = null;
    };
    const loadTimer = window.setTimeout(() => {
      if (!active) return;
      setCardSdkState("failed");
      track("checkout_error", { step: "card_sdk", reason: "load_timeout" });
      s.remove();
    }, 15000);
    s.onerror = () => {
      if (!active) return;
      window.clearTimeout(loadTimer);
      setCardSdkState("failed");
      track("checkout_error", { step: "card_sdk", reason: "load_error" });
    };
    s.onload = () => {
      if (!active) return;
      window.clearTimeout(loadTimer);
      if (typeof window.AppmaxScripts?.init !== "function") {
        setCardSdkState("failed");
        track("checkout_error", { step: "card_sdk", reason: "missing_api" });
        return;
      }
      try {
        window.AppmaxScripts.init({
          externalId: cfg.externalId,
          onTokenize: ({ token }) => {
            if (!active || !cardTokenizationPending.current) return;
            cardTokenizationPending.current = false;
            clearTokenTimer();
            void submitPaymentRef.current(token);
          },
          onError: () => {
            if (!active || !cardTokenizationPending.current) return;
            cardTokenizationPending.current = false;
            clearTokenTimer();
            setBusy(false);
            setError("Não foi possível validar o cartão. Confira os dados e tente de novo.");
            track("checkout_error", { step: "card_sdk", reason: "tokenization_failed" });
          },
        });
        setCardSdkState("ready");
      } catch {
        setCardSdkState("failed");
        track("checkout_error", { step: "card_sdk", reason: "init_failed" });
      }
    };
    document.body.appendChild(s);
    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      cardTokenizationPending.current = false;
      clearTokenTimer();
      s.remove();
    };
  }, [cfg?.externalId, cfg?.sandbox, cfg?.cardEnabled, cardSdkRetry]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || cardDone || paymentInFlight.current) return;
    if (couponChecking) {
      setError("Aguarde a validação do cupom antes de iniciar o pagamento.");
      return;
    }
    if (!cfg || (pay === "pix" ? !cfg.pixEnabled : !cfg.cardEnabled)) {
      setError("Aguarde a verificação das formas de pagamento antes de continuar.");
      return;
    }
    if (!shippingQuoteCurrent || !chosen) {
      setError("O CEP ou a sacola mudou. Aguarde uma nova cotação de frete antes de pagar.");
      return;
    }
    if (f.nome.trim().length < 3) {
      track("checkout_error", { step: "customer", reason: "invalid_name" });
      setError("Informe um nome completo válido para continuar.");
      nameRef.current?.focus();
      return;
    }
    if (!isValidCpf(f.cpf)) {
      track("checkout_error", { step: "customer", reason: "invalid_cpf" });
      setCpfInvalid(true);
      setError("CPF inválido. Confira os números.");
      cpfRef.current?.focus();
      return;
    }
    if (!isValidBrazilWhatsapp(f.whatsapp)) {
      track("checkout_error", { step: "customer", reason: "invalid_whatsapp" });
      setError("Informe um WhatsApp com DDD válido.");
      whatsappRef.current?.focus();
      return;
    }
    if (!hasDeliveryAddress(f)) {
      track("checkout_error", { step: "delivery", reason: "empty_address" });
      setError("Preencha o endereço de entrega: rua, número, bairro e cidade.");
      (f.rua.trim() ? numeroRef.current : streetRef.current)?.focus();
      return;
    }
    if (!isValidBrazilUF(f.uf)) {
      track("checkout_error", { step: "delivery", reason: "invalid_uf" });
      setError("Informe uma UF válida, como MG, SP ou RJ.");
      ufRef.current?.focus();
      return;
    }
    // A delayed affiliate lookup must not change the coupon once this payment
    // attempt has begun, even if the buyer never opened the coupon field.
    checkoutSubmissionStarted.current = true;
    track("add_payment_info", { payment_type: pay, value: total });
    if (pay === "pix") void submitPayment();
    else if (!cfg?.cardEnabled)
      setError("Pagamento por cartão indisponível no momento. Use o Pix ou entre em contato.");
    else if (cardSdkState !== "ready")
      setError(
        "A validação segura do cartão ainda não carregou. Recarregue a validação ou escolha Pix.",
      );
    else {
      const cardForm = document.getElementById("card-form");
      if (!(cardForm instanceof HTMLFormElement) || !cardForm.reportValidity()) return;
      cardTokenizationPending.current = true;
      setBusy(true);
      setError(null);
      cardTokenizationTimer.current = window.setTimeout(() => {
        if (!cardTokenizationPending.current) return;
        cardTokenizationPending.current = false;
        cardTokenizationTimer.current = null;
        setBusy(false);
        setError(
          "A validação do cartão não respondeu. Nenhuma cobrança foi solicitada. Tente novamente ou escolha Pix.",
        );
        track("checkout_error", { step: "card_sdk", reason: "tokenization_timeout" });
      }, 18000);
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
            canRestart={pixRetryVerified === pix.orderId}
            onRestart={() => {
              if (pixRetryVerified !== pix.orderId) return;
              clearPendingPix();
              setPixRetryVerified(null);
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

  if (cardDone && !cardDone.paid) {
    const ended = isTerminatedOrder(cardDone.status) && cardRetryVerified === cardDone.orderId;
    const declined = ended && ["cancelado", "recusado_por_risco"].includes(cardDone.status);
    return (
      <Shell>
        <div className="container-site max-w-xl py-16 text-center" role="status" aria-live="polite">
          <h1 className="font-display text-h1">
            {cardDone.verificationOnly
              ? declined
                ? "Pedido cancelado"
                : "Pedido em verificação"
              : declined
                ? "Pagamento não aprovado"
                : ended
                  ? "Pedido em revisão"
                  : "Pagamento em análise"}
          </h1>
          <p className="mt-3 text-body text-muted-foreground">
            Pedido nº {cardDone.orderId}.
            {cardDone.verificationOnly
              ? declined
                ? " A Appmax confirmou o encerramento desta tentativa. Se precisar, consulte o atendimento antes de comprar novamente."
                : " O pagamento anterior ainda não pôde ser confirmado. Se foi Pix, não recebemos um QR Code recuperável; nenhum outro Pix ou cartão será gerado automaticamente. A situação será consultada junto à Appmax."
              : ended && !declined
                ? " A situação exige revisão do atendimento. Não crie outro pagamento para este pedido."
                : declined
                  ? " A Appmax informou que este pedido não foi aprovado. Consulte o suporte antes de iniciar uma nova tentativa."
                  : cardDone.status === "autorizado"
                    ? " O banco autorizou o cartão, mas a análise antifraude ainda não terminou."
                    : " Estamos verificando a confirmação junto à Appmax. Este processo pode levar alguns minutos."}
          </p>
          {!declined ? (
            <p className="mt-4 rounded-lg border border-border bg-muted p-4 text-body">
              Não efetue outro pagamento sem confirmar a situação deste pedido. A página consulta a
              Appmax automaticamente.
            </p>
          ) : (
            <button
              type="button"
              className="mt-6 w-full rounded-full border border-border px-6 py-3 font-medium"
              onClick={() => {
                if (!declined) return;
                clearPendingCard();
                setCardRetryVerified(null);
                setCardDone(null);
                setError(null);
              }}
            >
              {cardDone.verificationOnly
                ? "Voltar após cancelamento confirmado"
                : "Tentar novamente após a recusa"}
            </button>
          )}
          <Link
            to="/conta"
            className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
          >
            Acompanhar pelo atendimento
          </Link>
        </div>
      </Shell>
    );
  }

  if (cardDone?.paid)
    return (
      <Shell>
        <div className="container-site max-w-xl py-16 text-center" role="status">
          <h1 className="font-display text-h1">Pagamento aprovado!</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Pedido nº {cardDone.orderId}. Guarde este número para acompanhar seu pedido pela área
            Meus pedidos ou pelo atendimento.
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

  if (paymentRecoveryRequired)
    return (
      <Shell>
        <div className="container-site max-w-xl py-16 text-center" role="status" aria-live="polite">
          <h1 className="font-display text-h1">Pagamento em verificação</h1>
          <p className="mt-4 text-body text-muted-foreground">
            A conexão foi interrompida ou a confirmação não chegou ao navegador. Isso não significa
            que o pagamento foi recusado. Para evitar uma cobrança duplicada, não tente gerar outro
            Pix ou pagar com outro cartão antes de consultar a situação do pedido.
          </p>
          <p className="mt-4 rounded-lg border border-border bg-muted p-4 text-body">
            Nenhuma nova cobrança será iniciada automaticamente nesta aba. O atendimento pode ajudar
            a localizar sua tentativa pelo contato informado na compra.
          </p>
          <Link
            to="/conta"
            className="mt-6 inline-block rounded-full bg-action px-6 py-3 text-action-foreground"
          >
            Consultar atendimento
          </Link>
        </div>
      </Shell>
    );

  if (!hydrated)
    return (
      <Shell>
        <div className="container-site min-h-[50vh] py-20" aria-busy="true">
          <noscript>
            <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center">
              <h1 className="font-display text-h1">Checkout precisa de JavaScript</h1>
              <p className="mt-3 text-body">
                Ative o JavaScript para finalizar sua compra com segurança. Sua sacola não será
                enviada sem sua confirmação.
              </p>
              <a
                href="/loja"
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-emerald-600 px-6 font-semibold text-white"
              >
                Voltar à loja
              </a>
            </section>
          </noscript>
        </div>
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

  // No gateway available: do not invite the buyer to enter identity/address/card data
  // into a form that cannot complete a payment. Existing orders are handled above.
  if (cfg && !cfg.pixEnabled && !cfg.cardEnabled)
    return (
      <Shell>
        <section className="container-site mx-auto max-w-2xl py-14 sm:py-20" role="status">
          <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-12">
            <span className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-muted text-foreground">
              <Lock className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="font-display text-h1">
              {configLookupFailed
                ? "Não foi possível verificar as formas de pagamento"
                : "Pagamento online indisponível"}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-body text-muted-foreground">
              {configLookupFailed
                ? "A consulta aos meios de pagamento falhou ou demorou demais. Sua sacola continua salva; nenhum pagamento foi solicitado."
                : "Não é possível finalizar a compra pelo site agora. Sua sacola continua salva neste navegador e nenhum pagamento foi solicitado."}
            </p>
            <p className="mx-auto mt-2 max-w-lg text-body text-muted-foreground">
              Para consultar uma alternativa de atendimento, fale diretamente com a equipe Vonix
              Hair.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {configLookupFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setCfg(null);
                    setConfigLookupFailed(false);
                    setConfigRetry((previous) => previous + 1);
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-700 bg-emerald-50 px-6 py-3 text-body font-semibold text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Tentar consultar novamente
                </button>
              )}
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-body font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Falar com atendimento
              </a>
              <Link
                to="/carrinho"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-6 py-3 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Voltar à sacola
              </Link>
            </div>
          </div>
        </section>
      </Shell>
    );

  const inst = installments(total);

  return (
    <Shell>
      <div className="container-site grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          {!cfg && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl border border-border bg-muted px-4 py-3 text-body text-muted-foreground"
            >
              Verificando as formas de pagamento. Os campos serão liberados quando essa consulta
              terminar.
              <Link to="/carrinho" className="ml-2 font-semibold underline underline-offset-2">
                Voltar à sacola
              </Link>
            </p>
          )}
          <form
            id="checkout-form"
            className="min-w-0 space-y-8"
            inert={!cfg || busy}
            aria-busy={!cfg || busy}
            onSubmit={onSubmit}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-h1">Finalizar compra</h1>
                <Link
                  to="/carrinho"
                  className="inline-flex min-h-11 items-center text-body font-medium underline underline-offset-4 focus-visible:outline-2"
                >
                  Editar sacola
                </Link>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3 text-body lg:hidden">
                <div>
                  <p className="font-semibold">Resumo rápido da compra</p>
                  <p className="text-small text-muted-foreground">
                    {c.count} {c.count === 1 ? "item" : "itens"} ·{" "}
                    {chosen
                      ? chosen.free
                        ? "Frete grátis cotado"
                        : `Frete ${brl(shipping)}`
                      : "Frete calculado pelo CEP"}
                  </p>
                </div>
                <b className="shrink-0 text-name">{chosen ? brl(total) : brl(t.net)}</b>
              </div>
              {cfg?.sandbox && (
                <p
                  role="note"
                  className="mt-3 rounded-lg border border-foreground bg-muted p-3 text-body"
                >
                  <b>Ambiente de testes.</b> Nenhuma cobrança real será feita.
                </p>
              )}
            </div>

            <fieldset className={panel}>
              <StepTitle n={1}>Contato</StepTitle>
              <input
                required
                ref={nameRef}
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
              <input
                required
                inputMode="tel"
                ref={whatsappRef}
                aria-label="WhatsApp com DDD"
                placeholder="WhatsApp com DDD"
                value={f.whatsapp}
                onChange={set("whatsapp")}
                autoComplete="tel"
                className={inp}
              />
              <input
                ref={cpfRef}
                required
                inputMode="numeric"
                aria-label="CPF"
                aria-invalid={cpfInvalid}
                aria-describedby={cpfInvalid ? "checkout-cpf-error" : undefined}
                placeholder="CPF"
                value={f.cpf}
                maxLength={14}
                onChange={(e) => {
                  setCpfInvalid(false);
                  setError((old) => (old === "CPF inválido. Confira os números." ? null : old));
                  setF((old) => ({ ...old, cpf: maskCpf(e.target.value) }));
                }}
                className={inp}
              />
              {cpfInvalid && (
                <p id="checkout-cpf-error" role="alert" className="text-body text-destructive">
                  CPF inválido. Confira os números.
                </p>
              )}
            </fieldset>

            <fieldset className={panel}>
              <StepTitle n={2}>Entrega</StepTitle>
              <input
                required
                inputMode="numeric"
                aria-label="CEP"
                placeholder="CEP (00000-000)"
                value={f.cep}
                maxLength={9}
                onChange={(e) => {
                  const m = maskCep(e.target.value);
                  setF((old) => {
                    const previous = old.cep.replace(/\D/g, "");
                    const next = m.replace(/\D/g, "");
                    if (previous === next) return { ...old, cep: m };
                    // Old street, city, house number and complement belong to
                    // the old destination, not the buyer's new postal code.
                    return previous.length === 8
                      ? {
                          ...old,
                          cep: m,
                          rua: "",
                          numero: "",
                          complemento: "",
                          bairro: "",
                          cidade: "",
                          uf: "",
                        }
                      : { ...old, cep: m };
                  });
                }}
                autoComplete="postal-code"
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
              {cepLookupFailed && !cepLoading && f.cep.replace(/\D/g, "").length === 8 && (
                <button
                  type="button"
                  onClick={retryCepLookup}
                  className="min-h-11 rounded-lg border border-border px-4 text-body font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Tentar buscar CEP novamente
                </button>
              )}
              <input
                required
                ref={streetRef}
                aria-label="Rua"
                placeholder="Rua"
                value={f.rua}
                onChange={set("rua")}
                autoComplete="address-line1"
                className={inp}
              />
              <div className="grid grid-cols-2 gap-3">
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
                <input
                  aria-label="Complemento"
                  placeholder="Complemento (opcional)"
                  value={f.complemento}
                  onChange={set("complemento")}
                  autoComplete="address-line2"
                  className={inp}
                />
              </div>
              <input
                required
                ref={districtRef}
                aria-label="Bairro"
                placeholder="Bairro"
                value={f.bairro}
                onChange={set("bairro")}
                autoComplete="address-level3"
                className={inp}
              />
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <input
                  required
                  aria-label="Cidade"
                  placeholder="Cidade"
                  value={f.cidade}
                  onChange={set("cidade")}
                  autoComplete="address-level2"
                  className={inp}
                />
                <input
                  required
                  ref={ufRef}
                  aria-label="UF"
                  placeholder="UF"
                  value={f.uf}
                  onChange={set("uf")}
                  maxLength={2}
                  autoComplete="address-level1"
                  className={inp}
                />
              </div>

              <div className="space-y-2 pt-2" aria-live="polite">
                {quoting && <p className="text-body text-muted-foreground">Calculando frete…</p>}
                {quoteErr && !quoting && (
                  <div className="space-y-2">
                    <p role="alert" className="text-body text-destructive">
                      {quoteErr}
                    </p>
                    {f.cep.replace(/\D/g, "").length === 8 && (
                      <button
                        type="button"
                        onClick={() => setQuoteRetry((value) => value + 1)}
                        className="min-h-11 rounded-lg border border-destructive px-4 text-body font-medium text-destructive transition hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        Tentar calcular frete novamente
                      </button>
                    )}
                  </div>
                )}
                {shippingQuoteCurrent &&
                  options.map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-center justify-between rounded-xl border-2 p-3.5 text-body ${serviceId === o.id ? "border-action bg-card font-medium" : "border-border"}`}
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
                className={`flex items-center justify-between rounded-xl border-2 p-3.5 text-body ${pay === "pix" ? "border-action bg-card font-medium" : "border-border"}`}
              >
                <span className="flex gap-2">
                  <input
                    type="radio"
                    name="pay"
                    checked={pay === "pix"}
                    disabled={cfg ? !cfg.pixEnabled : false}
                    onChange={() => setPay("pix")}
                  />{" "}
                  Pix · até 5% em itens sem outra oferta{" "}
                  {cfg && !cfg.pixEnabled && "(indisponível)"}
                </span>
                <b>{brl(tPix.net + shipping)}</b>
              </label>
              <label
                className={`flex items-center justify-between rounded-xl border-2 p-3.5 text-body ${pay === "card" ? "border-action bg-card font-medium" : "border-border"}`}
              >
                <span className="flex gap-2">
                  <input
                    type="radio"
                    name="pay"
                    checked={pay === "card"}
                    disabled={cfg ? !cfg.cardEnabled : false}
                    onChange={() => setPay("card")}
                  />{" "}
                  Cartão de crédito · até 6x sem juros {cfg && !cfg.cardEnabled && "(indisponível)"}
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
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          void applyCoupon();
                        }
                      }}
                      placeholder="Código do cupom"
                      maxLength={40}
                      value={coupon}
                      onChange={(e) => {
                        couponEdited.current = true;
                        couponLookupSequence.current += 1;
                        setCouponChecking(false);
                        setCoupon(e.target.value);
                      }}
                      className={inp}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void applyCoupon();
                      }}
                      disabled={couponChecking}
                      className="shrink-0 rounded-lg border border-foreground px-4 text-body disabled:cursor-wait disabled:opacity-60"
                    >
                      Aplicar
                    </button>
                    <button
                      type="button"
                      aria-label="Remover cupom"
                      onClick={() => {
                        couponEdited.current = true;
                        couponLookupSequence.current += 1;
                        setCouponChecking(false);
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
                  {applied && couponProblem?.ok !== false && tCard.couponDiscount > 0 && (
                    <p role="status" className="text-small font-medium text-emerald-800">
                      Cupom ativo: {applied.code}. Desconto: {brl(tCard.couponDiscount)} nos itens
                      elegíveis.
                    </p>
                  )}
                  {applied && couponNoSavings && (
                    <p role="status" className="text-body text-muted-foreground">
                      Este carrinho não tem itens elegíveis ao cupom. Nenhum desconto adicional foi
                      considerado.
                    </p>
                  )}
                  {applied && couponProblem?.ok === false && (
                    <p role="status" className="text-body text-muted-foreground">
                      {couponProblem.reason}
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
          className="h-fit min-w-0 space-y-4 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1"
          aria-label="Resumo do pedido"
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
          {error && !cpfInvalid && (
            <p
              role="alert"
              className="rounded-lg border border-destructive p-3 text-body text-destructive"
            >
              {error}
            </p>
          )}
          {cfg && !(pay === "pix" ? cfg.pixEnabled : cfg.cardEnabled) && (
            <p role="status" className="rounded-lg border border-border bg-muted p-3 text-body">
              Estamos ativando os pagamentos desta loja. Em breve você poderá finalizar por aqui.
              Para comprar agora,{" "}
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="underline">
                fale com a gente no WhatsApp
              </a>
              .
            </p>
          )}
          {pay === "card" && cfg?.cardEnabled && cardSdkState !== "ready" && (
            <div role="status" className="rounded-lg border border-border bg-muted p-3 text-body">
              {cardSdkState === "failed"
                ? "Não foi possível carregar a validação segura do cartão. Você também pode pagar por Pix."
                : "Carregando validação segura do cartão…"}
              {cardSdkState === "failed" && (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setCardSdkRetry((n) => n + 1)}
                >
                  Recarregar validação
                </button>
              )}
            </div>
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
              disabled={
                busy ||
                quoting ||
                couponChecking ||
                !chosen ||
                !cfg ||
                !(pay === "pix" ? cfg.pixEnabled : cfg.cardEnabled) ||
                (pay === "card" && cardSdkState !== "ready")
              }
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
    </Shell>
  );
}
