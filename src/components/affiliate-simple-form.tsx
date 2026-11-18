import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { CheckCircle2, MapPin, Send, ShieldCheck, Instagram } from "lucide-react";
import { affiliateSimpleSchema } from "@/lib/affiliate-simple";
import { downloadAffiliatePrivateReceipt } from "@/lib/affiliate-private-receipt";
import { track } from "@/lib/analytics";
import { submitSimpleAffiliateApplication } from "@/lib/affiliate-functions";
import { WIZARD_BRAZIL_STATES, onlyDigits } from "@/lib/affiliate-wizard";

type Key =
  | "fullName"
  | "email"
  | "phone"
  | "postalCode"
  | "street"
  | "number"
  | "district"
  | "city"
  | "state"
  | "complement"
  | "instagram"
  | "instagramFollowers"
  | "tiktok"
  | "tiktokFollowers";

const pendingReceiptSessionKey = "vonix-affiliate-unconfirmed-code";

/** Resolve visibility at callback time, not from TypeScript's earlier narrowing.
 * Clipboard and visibility events can complete between awaited operations.
 */
function receiptTabHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Web Crypto creates 192 unpredictable bits before the request begins.
 * The code is a private bearer token: never include it in a URL or analytics.
 */
function createBrowserPrivateReceipt(): string {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const fields: Record<Key, string> = {
  fullName: "",
  email: "",
  phone: "",
  postalCode: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  complement: "",
  instagram: "",
  instagramFollowers: "",
  tiktok: "",
  tiktokFollowers: "",
};

const inputClass =
  "min-h-12 w-full rounded-xl border border-[#dec9cc] bg-white px-4 py-3 text-base text-[#39232f] outline-none transition focus:border-[#93606a] focus:ring-2 focus:ring-[#e8cccf] disabled:opacity-50";
const heading = "font-display text-2xl text-[#4e2934]";
const help = "mt-1.5 text-sm text-[#826b6f]";

function normalizeSocial(value: string, platform: "instagram" | "tiktok") {
  const trimmed = value.trim();
  // Let users paste their public profile URL instead of just the @username.
  if (!/^https:\/\//i.test(trimmed)) return trimmed.replace(/^@/, "");
  try {
    const url = new URL(trimmed);
    const domain = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      url.protocol !== "https:" ||
      /* Official share-link query parameters are intentionally discarded. */
      /* A validated direct profile path is authoritative even with a fragment. */
      url.username ||
      url.password ||
      url.port ||
      domain !== (platform === "instagram" ? "instagram.com" : "tiktok.com")
    )
      return trimmed;
    const match =
      platform === "instagram"
        ? url.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/)
        : url.pathname.match(/^\/@([A-Za-z0-9._]{2,30})\/?$/);
    return match?.[1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  required = true,
  maxLength,
  inputMode,
  autoComplete,
  onBlur,
  type = "text",
  disabled = false,
}: {
  id: Key;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: "numeric" | "tel" | "text";
  autoComplete?: string;
  onBlur?: () => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={"simple-" + id} className="mb-2 block text-sm font-semibold text-[#50383f]">
        {label}
        {required ? (
          <span aria-label="obrigatório" className="ml-1 text-[#9f5661]">
            *
          </span>
        ) : null}
      </label>
      <input
        id={"simple-" + id}
        name={id}
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "simple-error-" + id : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + (error ? " border-red-600" : "")}
      />
      {error ? (
        <p
          role="alert"
          id={"simple-error-" + id}
          className="mt-1 text-xs font-semibold text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AffiliateSimpleForm({
  preview = false,
  onDraftChange,
}: {
  preview?: boolean;
  onDraftChange?: (hasDraft: boolean) => void;
}) {
  const [values, setValues] = useState(fields);
  const [errors, setErrors] = useState<Partial<Record<Key | "privacyAccepted", string>>>({});
  const [accepted, setAccepted] = useState(false);
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingCopied, setTrackingCopied] = useState(false);
  // Async clipboard callbacks must never publish a result from a previous
  // receipt or a background tab. A synchronous guard prevents double-copy.
  const receiptCopyEpoch = useRef(0);
  const receiptCopying = useRef(false);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [trackingNavigationError, setTrackingNavigationError] = useState("");
  const attemptCode = useRef("");
  // A retry can reuse the private receipt only with exactly the same data.
  // Do not persist the applicant's sensitive form contents across sessions.
  const submittedPayload = useRef<string | null>(null);
  const [recoveredAttempt, setRecoveredAttempt] = useState(false);
  const [unconfirmedCode, setUnconfirmedCode] = useState("");
  const [unconfirmedCopied, setUnconfirmedCopied] = useState(false);
  const [unconfirmedHandoffError, setUnconfirmedHandoffError] = useState("");
  const [downloadFeedback, setDownloadFeedback] = useState("");

  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(pendingReceiptSessionKey) ?? "";
      if (/^[A-Za-z0-9_-]{32}$/.test(pending)) {
        attemptCode.current = pending;
        setUnconfirmedCode(pending);
        setRecoveredAttempt(true);
      } else {
        window.sessionStorage.removeItem(pendingReceiptSessionKey);
      }
    } catch {
      // The form still works when browser storage is denied; the user must
      // keep this page open to copy the pending code after a network failure.
    }
  }, []);

  // The receipt is a bearer token. Mask it again if a shared device changes tabs.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (receiptTabHidden()) {
        receiptCopyEpoch.current++;
        receiptCopying.current = false;
        setCodeRevealed(false);
        setTrackingCopied(false);
        setUnconfirmedCopied(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  function downloadCode(code: string, confirmed: boolean) {
    const initiated = downloadAffiliatePrivateReceipt(code, confirmed);
    setDownloadFeedback(
      initiated
        ? "Download solicitado. Confira seus arquivos e guarde o código em local privado."
        : "Este navegador não permitiu baixar o arquivo. Selecione e copie o código manualmente.",
    );
    if (!initiated)
      document
        .getElementById(confirmed ? "affiliate-confirmed-code" : "affiliate-unconfirmed-code")
        ?.focus();
  }

  async function copyUnconfirmedCode() {
    if (
      !/^[A-Za-z0-9_-]{32}$/.test(unconfirmedCode) ||
      receiptCopying.current ||
      receiptTabHidden()
    )
      return;
    const epoch = ++receiptCopyEpoch.current;
    receiptCopying.current = true;
    setUnconfirmedCopied(false);
    try {
      await navigator.clipboard.writeText(unconfirmedCode);
      if (epoch !== receiptCopyEpoch.current || receiptTabHidden()) return;
      setUnconfirmedCopied(true);
    } catch {
      if (epoch !== receiptCopyEpoch.current || receiptTabHidden()) return;
      setUnconfirmedCopied(false);
      const field = document.getElementById(
        "affiliate-unconfirmed-code",
      ) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    } finally {
      if (epoch === receiptCopyEpoch.current) receiptCopying.current = false;
    }
  }

  function discardUnconfirmedCode() {
    receiptCopyEpoch.current++;
    receiptCopying.current = false;
    setUnconfirmedHandoffError("");
    setDownloadFeedback("");
    attemptCode.current = "";
    submittedPayload.current = null;
    setRecoveredAttempt(false);
    setUnconfirmedCode("");
    setUnconfirmedCopied(false);
    setCodeRevealed(false);
    try {
      window.sessionStorage.removeItem(pendingReceiptSessionKey);
    } catch {
      /* restricted storage */
    }
  }

  function handoffUnconfirmedCode(event: MouseEvent<HTMLAnchorElement>) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(unconfirmedCode)) {
      event.preventDefault();
      return;
    }
    try {
      // The browser may throw OR silently ignore storage writes. Do not
      // navigate away with the only copy of this unconfirmed private token.
      window.sessionStorage.setItem("vonix-affiliate-once-code", unconfirmedCode);
      if (window.sessionStorage.getItem("vonix-affiliate-once-code") !== unconfirmedCode)
        throw new Error("Private handoff unavailable.");
      setUnconfirmedHandoffError("");
    } catch {
      event.preventDefault();
      setUnconfirmedHandoffError(
        "Copie e guarde o código da tentativa antes de abrir o acompanhamento. Este navegador não permitiu transferi-lo automaticamente.",
      );
      document.getElementById("affiliate-unconfirmed-code")?.focus();
    }
  }

  async function copyTrackingCode() {
    if (!trackingCode || receiptCopying.current || receiptTabHidden()) return;
    const epoch = ++receiptCopyEpoch.current;
    receiptCopying.current = true;
    setTrackingCopied(false);
    try {
      await navigator.clipboard.writeText(trackingCode);
      if (epoch !== receiptCopyEpoch.current || receiptTabHidden()) return;
      setTrackingCopied(true);
    } catch {
      if (epoch !== receiptCopyEpoch.current || receiptTabHidden()) return;
      setTrackingCopied(false);
      document.getElementById("affiliate-confirmed-code")?.focus();
    } finally {
      if (epoch === receiptCopyEpoch.current) receiptCopying.current = false;
    }
  }

  function openTrackingWithCode() {
    if (!/^[A-Za-z0-9_-]{32}$/.test(trackingCode)) return;
    try {
      window.sessionStorage.setItem("vonix-affiliate-once-code", trackingCode);
      if (window.sessionStorage.getItem("vonix-affiliate-once-code") !== trackingCode)
        throw new Error("One-time handoff is unavailable.");
    } catch {
      // A confirmed receipt exists only in this UI if the browser denies storage.
      // Never navigate away while losing the only accessible private code.
      setTrackingNavigationError(
        "Este navegador bloqueou a transferência automática. Copie e guarde o código antes de abrir o acompanhamento pelo link abaixo.",
      );
      document.getElementById("affiliate-confirmed-code")?.focus();
      return;
    }
    setTrackingNavigationError("");
    window.location.assign("/consultar-candidatura");
  }
  const [message, setMessage] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipFeedback, setZipFeedback] = useState("");
  const zipRequest = useRef(0);
  // Track only CEP-provided values. Never clear an applicant's manual edits.
  const zipAutoFilled = useRef<Partial<Record<"street" | "district" | "city" | "state", string>>>(
    {},
  );
  const submitting = useRef(false);
  const dirty = Object.values(values).some(Boolean) || accepted || !!trap;

  // Address data returned by a third-party CEP provider must not silently
  // update a private application draft while the page is backgrounded.
  useEffect(() => {
    const onVisibility = () => {
      if (!receiptTabHidden()) return;
      zipRequest.current++;
      setZipLoading(false);
      setZipFeedback("");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    onDraftChange?.(dirty && !sent);
  }, [dirty, sent, onDraftChange]);

  useEffect(() => {
    if (!dirty || sent) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, sent]);

  function update(key: Key, raw: string) {
    // Do not let the visible values drift away from an in-flight, signed receipt.
    if (submitting.current) return;
    const value =
      key === "postalCode"
        ? onlyDigits(raw)
            .slice(0, 8)
            .replace(/^(\d{5})(\d)/, "$1-$2")
        : key === "instagram" || key === "tiktok"
          ? raw.slice(0, 240)
          : raw;
    if (key === "postalCode") {
      if (onlyDigits(value) !== onlyDigits(values.postalCode)) {
        // Old results can no longer overwrite a changed CEP; allow a new lookup.
        zipRequest.current++;
        setZipLoading(false);
        setZipFeedback("");
        const auto = zipAutoFilled.current;
        zipAutoFilled.current = {};
        setValues((prev) => ({
          ...prev,
          postalCode: value,
          street: auto.street && prev.street === auto.street ? "" : prev.street,
          district: auto.district && prev.district === auto.district ? "" : prev.district,
          city: auto.city && prev.city === auto.city ? "" : prev.city,
          state: auto.state && prev.state === auto.state ? "" : prev.state,
        }));
      }
    } else {
      if (key === "street" || key === "district" || key === "city" || key === "state") {
        delete zipAutoFilled.current[key];
      }
      setValues((prev) => ({ ...prev, [key]: value }));
    }
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage("");
  }

  async function lookupPostalCode() {
    const digits = onlyDigits(values.postalCode);
    if (digits.length !== 8 || zipLoading || receiptTabHidden()) return;
    const request = ++zipRequest.current;
    setZipLoading(true);
    setZipFeedback("");
    try {
      const res = await fetch("https://viacep.com.br/ws/" + digits + "/json/", {
        signal: AbortSignal.timeout(5000),
      });
      // A CEP response has no authority over a form hidden in another tab.
      if (zipRequest.current !== request || receiptTabHidden()) return;
      if (!res.ok) {
        if (zipRequest.current === request)
          setZipFeedback(
            "Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.",
          );
        return;
      }
      const data: unknown = await res.json();
      if (zipRequest.current !== request || receiptTabHidden()) return;
      if (typeof data !== "object" || !data || "erro" in data) {
        setZipFeedback("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      const obj = data as Record<string, unknown>;
      const text = (key: string, limit: number) => {
        const v = obj[key];
        return typeof v === "string" && v.trim().length <= limit ? v.trim() : "";
      };
      const uf = text("uf", 2).toUpperCase();
      if (!WIZARD_BRAZIL_STATES.some((state) => state === uf)) {
        setZipFeedback("Não foi possível validar o endereço deste CEP. Preencha manualmente.");
        return;
      }
      setZipFeedback("CEP consultado. Confira os dados e complete o endereço.");
      setValues((prev) => {
        if (
          zipRequest.current !== request ||
          receiptTabHidden() ||
          onlyDigits(prev.postalCode) !== digits
        )
          return prev;
        const suggested = {
          street: text("logradouro", 120),
          district: text("bairro", 90),
          city: text("localidade", 90),
          state: uf,
        };
        const next = { ...prev };
        for (const key of ["street", "district", "city", "state"] as const) {
          if (!prev[key] && suggested[key]) {
            next[key] = suggested[key];
            zipAutoFilled.current[key] = suggested[key];
          }
        }
        return next;
      });
    } catch {
      if (zipRequest.current === request && !receiptTabHidden())
        setZipFeedback(
          "Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.",
        );
    } finally {
      if (zipRequest.current === request) setZipLoading(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || submitting.current || sent) return;
    if (recoveredAttempt) {
      setMessage(
        "Esta tentativa foi recuperada de outra visita. Consulte o código anterior e descarte-o antes de iniciar uma nova inscrição.",
      );
      document.getElementById("affiliate-unconfirmed-code")?.focus();
      return;
    }
    const parsed = affiliateSimpleSchema.safeParse({
      ...values,
      instagram: normalizeSocial(values.instagram, "instagram"),
      tiktok: normalizeSocial(values.tiktok, "tiktok"),
      instagramFollowers: /^\d+$/.test(values.instagramFollowers)
        ? Number(values.instagramFollowers)
        : NaN,
      tiktokFollowers:
        values.tiktokFollowers.trim() === ""
          ? null
          : /^\d+$/.test(values.tiktokFollowers)
            ? Number(values.tiktokFollowers)
            : NaN,
      privacyAccepted: accepted,
      website: trap,
    });
    if (!parsed.success) {
      const failures: Partial<Record<Key | "privacyAccepted", string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Key | "privacyAccepted";
        if (!failures[key]) failures[key] = issue.message;
      }
      setErrors(failures);
      document.getElementById("simple-" + String(parsed.error.issues[0]?.path[0] ?? ""))?.focus();
      return;
    }
    if (preview) {
      setMessage("Esta é apenas uma prévia. Nenhuma candidatura foi enviada.");
      return;
    }
    const payload = JSON.stringify(parsed.data);
    if (attemptCode.current && submittedPayload.current !== payload) {
      setMessage(
        "Os dados foram alterados desde a tentativa anterior. Consulte o código existente e descarte-o antes de iniciar outra inscrição.",
      );
      document.getElementById("affiliate-unconfirmed-code")?.focus();
      return;
    }
    // Ignore any CEP response that arrives after submission starts.
    zipRequest.current++;
    setZipLoading(false);
    submitting.current = true;
    setCodeRevealed(false);
    setSending(true);
    setMessage("");
    try {
      // Reuse this 192-bit code on a retry. Without it a lost response might
      // create an unreachable application and a second submission conflict.
      if (!attemptCode.current) {
        attemptCode.current = createBrowserPrivateReceipt();
        submittedPayload.current = payload;
        try {
          window.sessionStorage.setItem(pendingReceiptSessionKey, attemptCode.current);
        } catch {
          // Secure in-memory fallback; show the code after any uncertain reply.
        }
      }
      const result = await submitSimpleAffiliateApplication({
        data: { ...parsed.data, trackingCode: attemptCode.current },
      });
      if (result.ok) {
        // A honeypot can acknowledge without saving a real application.
        // Never confirm success or fire a Meta Lead without a private receipt.
        const receipt =
          "trackingCode" in result &&
          typeof result.trackingCode === "string" &&
          /^[A-Za-z0-9_-]{32}$/.test(result.trackingCode)
            ? result.trackingCode
            : "";
        if (!receipt || receipt !== attemptCode.current) {
          setUnconfirmedCode(attemptCode.current);
          setMessage(
            "Não foi possível confirmar o recebimento. Guarde o código de tentativa e consulte o portal antes de tentar novamente.",
          );
          return;
        }
        discardUnconfirmedCode();
        track("sign_up", { method: "affiliate_application" });
        setTrackingCode(receipt);
        setSent(true);
        setValues({ ...fields });
        setAccepted(false);
      } else {
        setUnconfirmedCode(attemptCode.current);
        setMessage(result.reason);
      }
    } catch {
      if (attemptCode.current) setUnconfirmedCode(attemptCode.current);
      setMessage(
        "Não foi possível confirmar o envio. A inscrição pode ter sido salva; guarde o código de tentativa e consulte o portal antes de reenviar.",
      );
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  if (sent)
    return (
      <section
        role="status"
        className="rounded-[2rem] border border-[#e9d7d0] bg-white px-8 py-14 text-center shadow-lg"
      >
        <CheckCircle2 aria-hidden="true" className="mx-auto h-14 w-14 text-[#38705a]" />
        <h3 className="mt-5 font-display text-4xl text-[#482b37]">Inscrição recebida!</h3>
        <p className="mx-auto mt-4 max-w-lg text-[#70575e]">
          Obrigada pelo interesse na Vonix Hair. Nossa equipe analisará seu Instagram e, se
          informado, seu TikTok e, caso necessário, entrará em contato pelo telefone informado.
        </p>
        {trackingCode && (
          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-[#d4b8bd] bg-[#fff8f5] p-5">
            <p className="text-sm font-bold text-[#633a43]">Guarde seu código de acompanhamento</p>
            <p className="mt-1 text-xs leading-relaxed text-[#775d65]">
              Este código é privado: com ele você consulta o resultado e o motivo de uma eventual
              recusa. Salve agora, pois este código não é enviado por e-mail nem recuperado pela
              equipe.
            </p>
            <input
              readOnly
              id="affiliate-confirmed-code"
              type={codeRevealed ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              aria-label="Código privado de acompanhamento"
              value={trackingCode}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 w-full rounded-lg border border-[#d5bac0] bg-white px-3 py-3 text-center font-semibold text-sm tracking-wider text-[#49323a]"
            />
            <button
              type="button"
              aria-pressed={codeRevealed}
              onClick={() => setCodeRevealed((value) => !value)}
              className="mt-3 min-h-11 w-full rounded-full border border-[#b9969e] px-4 text-sm font-bold text-[#683643]"
            >
              {codeRevealed ? "Ocultar código privado" : "Mostrar código privado"}
            </button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void copyTrackingCode()}
                className="min-h-12 rounded-full border border-[#b9969e] px-4 text-sm font-bold text-[#683643]"
              >
                {trackingCopied ? "Código copiado!" : "Copiar código"}
              </button>
              <button
                type="button"
                onClick={() => downloadCode(trackingCode, true)}
                className="min-h-12 rounded-full border border-[#b9969e] px-4 text-sm font-bold text-[#683643]"
              >
                Baixar código de acompanhamento
              </button>
              <button
                type="button"
                onClick={openTrackingWithCode}
                className="min-h-12 rounded-full bg-[#633847] px-4 text-sm font-bold text-white"
              >
                Acompanhar inscrição agora
              </button>
            </div>
            {downloadFeedback && (
              <p className="mt-3 text-xs leading-relaxed text-[#775d65]">{downloadFeedback}</p>
            )}
            {trackingNavigationError && (
              <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                {trackingNavigationError}
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-[#775d65]">
              O código também pode ser digitado mais tarde em{" "}
              <a href="/consultar-candidatura" className="font-semibold underline">
                vonixhair.com/consultar-candidatura
              </a>
              . O acompanhamento imediato usa este navegador e não coloca o código no endereço da
              página.
            </p>
          </div>
        )}
        <p className="mx-auto mt-3 max-w-lg text-sm text-[#7c6369]">
          A candidatura não garante aprovação ou parceria. O código privado não é enviado por
          e-mail: guarde-o em local privado. Se não for selecionada, você poderá se candidatar
          novamente.
        </p>
      </section>
    );

  const field = (
    key: Key,
    label: string,
    options: {
      placeholder?: string;
      maxLength?: number;
      required?: boolean;
      inputMode?: "numeric" | "tel" | "text";
      autoComplete?: string;
      onBlur?: () => void;
    } = {},
  ) => (
    <Field
      id={key}
      type={key === "phone" ? "tel" : key === "email" ? "email" : "text"}
      label={label}
      value={values[key]}
      disabled={sending}
      onChange={(value) => update(key, value)}
      error={errors[key]}
      {...options}
    />
  );

  return (
    <form
      aria-busy={sending}
      onSubmit={(e) => void submit(e)}
      className="overflow-hidden rounded-[2rem] border border-[#eadbd6] bg-white shadow-[0_15px_70px_rgba(80,32,39,.08)]"
    >
      <div className="bg-[#fcf6f3] px-6 py-7 sm:px-10">
        <span className="text-xs font-bold uppercase tracking-[.2em] text-[#925962]">
          Inscrição Vonix Hair
        </span>
        <h3 className="mt-3 font-display text-3xl text-[#482b37]">É simples participar.</h3>
        <p className={help}>Preencha seus dados e perfis sociais em um único formulário.</p>
      </div>

      <div className="space-y-9 px-6 py-8 sm:px-10 sm:py-10">
        <section aria-labelledby="simple-contact-heading" className="space-y-5">
          <div>
            <h4 id="simple-contact-heading" className={heading}>
              Seus dados
            </h4>
            <p className={help}>Como podemos identificar sua candidatura e entrar em contato.</p>
          </div>
          {field("fullName", "Nome completo", {
            placeholder: "Seu nome e sobrenome",
            maxLength: 120,
            autoComplete: "name",
          })}
          {field("email", "E-mail", {
            placeholder: "seu@email.com",
            maxLength: 180,
            autoComplete: "email",
            required: true,
          })}
          <p className="text-xs leading-relaxed text-[#80666a]">
            O e-mail é obrigatório para contato sobre sua candidatura. Não enviaremos seu código de
            acompanhamento por e-mail: guarde-o ao concluir a inscrição.
          </p>
          {field("phone", "Telefone com DDD", {
            placeholder: "(31) 99999-9999",
            maxLength: 20,
            autoComplete: "tel",
            inputMode: "tel",
          })}
        </section>

        <section
          aria-labelledby="simple-address-heading"
          className="space-y-5 border-t border-[#f0e2df] pt-8"
        >
          <div className="flex items-center gap-3">
            <MapPin aria-hidden="true" className="h-6 w-6 text-[#8a5864]" />
            <div>
              <h4 id="simple-address-heading" className={heading}>
                Endereço completo
              </h4>
              <p className={help}>
                Inclua CEP e número do imóvel. Usaremos esses dados somente para a análise e contato
                relacionado à seleção.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            {field("postalCode", "CEP", {
              placeholder: "00000-000",
              maxLength: 9,
              inputMode: "numeric",
              autoComplete: "postal-code",
              onBlur: () => void lookupPostalCode(),
            })}
            <button
              type="button"
              onClick={() => void lookupPostalCode()}
              disabled={sending || zipLoading || onlyDigits(values.postalCode).length !== 8}
              className="min-h-12 rounded-xl border border-[#c9aeb2] px-5 text-sm font-semibold text-[#633a43] disabled:opacity-50"
            >
              {zipLoading ? "Buscando CEP..." : "Buscar CEP"}
            </button>
          </div>
          {zipFeedback && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl border border-[#ead8cd] bg-[#fff9f5] px-4 py-3 text-sm text-[#704b53]"
            >
              {zipFeedback}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            {field("street", "Rua / Avenida", {
              placeholder: "Nome do logradouro",
              maxLength: 120,
              autoComplete: "address-line1",
            })}
            {field("number", "Número", { placeholder: "123 ou s/n", maxLength: 15 })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("district", "Bairro", { maxLength: 90, autoComplete: "address-level3" })}
            {field("city", "Cidade", { maxLength: 90, autoComplete: "address-level2" })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="simple-state"
                className="mb-2 block text-sm font-semibold text-[#50383f]"
              >
                Estado (UF) *
              </label>
              <select
                id="simple-state"
                name="state"
                disabled={sending}
                required
                className={inputClass}
                value={values.state}
                aria-invalid={Boolean(errors.state)}
                onChange={(e) => update("state", e.target.value)}
              >
                <option value="">Selecione o estado</option>
                {WIZARD_BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {errors.state ? (
                <p role="alert" className="mt-1 text-xs text-red-700">
                  {errors.state}
                </p>
              ) : null}
            </div>
            {field("complement", "Complemento (opcional)", {
              required: false,
              placeholder: "Apto, bloco, casa...",
              maxLength: 120,
              autoComplete: "address-line2",
            })}
          </div>
        </section>

        <section
          aria-labelledby="simple-social-heading"
          className="space-y-5 border-t border-[#f0e2df] pt-8"
        >
          <div className="flex items-center gap-3">
            <Instagram aria-hidden="true" className="h-6 w-6 text-[#8a5864]" />
            <div>
              <h4 id="simple-social-heading" className={heading}>
                Redes sociais
              </h4>
              <p className={help}>
                Instagram e seus seguidores são obrigatórios. TikTok e seus seguidores são
                opcionais.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            {field("instagram", "Instagram", {
              placeholder: "@seuperfil",
              maxLength: 240,
              autoComplete: "off",
            })}
            {field("instagramFollowers", "Seguidores no Instagram", {
              placeholder: "Ex.: 2500",
              inputMode: "numeric",
              maxLength: 10,
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            {field("tiktok", "TikTok (opcional)", {
              placeholder: "@seuperfil (se tiver)",
              maxLength: 240,
              autoComplete: "off",
              required: false,
            })}
            {field("tiktokFollowers", "Seguidores no TikTok (opcional)", {
              placeholder: "Ex.: 900 (se tiver)",
              required: false,
              inputMode: "numeric",
              maxLength: 10,
            })}
          </div>
        </section>

        <div className="border-t border-[#f0e2df] pt-7">
          {/* Mandatory LGPD consent is a legal acknowledgement, not an extra questionnaire. */}
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#654b53]">
            <input
              type="checkbox"
              disabled={sending}
              required
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((old) => ({ ...old, privacyAccepted: "" }));
              }}
              className="mt-1 h-4 w-4 accent-[#633a43]"
            />
            Autorizo o uso destes dados para análise da candidatura e eventual contato sobre o
            programa de afiliadas, conforme a política de privacidade da Vonix Hair. Declaro ter 18
            anos ou mais.
          </label>
          <p className="mt-2 text-xs text-[#806a6e]">
            Leia nossa{" "}
            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Política de Privacidade
            </a>
            .
          </p>
          {errors.privacyAccepted ? (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
              {errors.privacyAccepted}
            </p>
          ) : null}
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label htmlFor="simple-website">Site</label>
            <input
              id="simple-website"
              type="text"
              disabled={sending}
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>
          {message ? (
            <p role="alert" className="mt-4 rounded-xl bg-[#fff5f1] p-4 text-sm text-[#844954]">
              {message}
            </p>
          ) : null}
          {!preview && unconfirmedCode ? (
            <section
              aria-label="Tentativa de inscrição não confirmada"
              className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-[#604448]"
            >
              <p className="font-bold">Guarde o código desta tentativa</p>
              <p className="mt-2">
                Ainda não temos confirmação de inscrição. Este código não comprova que ela foi
                salva, mas permite consultar o resultado caso a conexão tenha caído depois do
                registro. Não compartilhe com outras pessoas.
              </p>
              <input
                id="affiliate-unconfirmed-code"
                type={codeRevealed ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                aria-label="Código privado da tentativa não confirmada"
                readOnly
                value={unconfirmedCode}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-3 w-full rounded-lg border border-amber-200 bg-white p-3 text-center font-semibold tracking-wide"
              />
              <button
                type="button"
                aria-pressed={codeRevealed}
                onClick={() => setCodeRevealed((value) => !value)}
                className="mt-3 min-h-11 w-full rounded-full border border-amber-300 px-4 text-sm font-bold text-[#683643]"
              >
                {codeRevealed ? "Ocultar código da tentativa" : "Mostrar código da tentativa"}
              </button>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void copyUnconfirmedCode()}
                  className="min-h-11 rounded-full border border-[#b9969e] px-4 font-bold"
                >
                  {unconfirmedCopied
                    ? "Código de tentativa copiado!"
                    : "Copiar código de tentativa"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadCode(unconfirmedCode, false)}
                  className="min-h-11 rounded-full border border-[#b9969e] px-4 font-bold"
                >
                  Baixar código de tentativa
                </button>
                <a
                  href="/consultar-candidatura"
                  onClick={handoffUnconfirmedCode}
                  className="inline-flex min-h-11 items-center rounded-full border border-[#b9969e] px-4 font-bold underline"
                >
                  Consultar código no portal
                </a>
                <button
                  type="button"
                  onClick={discardUnconfirmedCode}
                  className="min-h-11 px-4 text-xs underline"
                >
                  Descartar código e iniciar nova tentativa
                </button>
              </div>
              {downloadFeedback && (
                <p className="mt-2 text-xs leading-relaxed">{downloadFeedback}</p>
              )}
              {unconfirmedHandoffError && (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
                  {unconfirmedHandoffError}
                </p>
              )}
              <p className="mt-2 text-xs">
                {recoveredAttempt
                  ? "Esta tentativa foi recuperada de outra visita. Consulte o código antigo e descarte-o apenas quando tiver certeza de que quer iniciar outra inscrição. O formulário fica bloqueado para não associar dados de outra pessoa ao código anterior."
                  : "Ao repetir uma tentativa nesta página, o sistema mantém o mesmo código e exige os mesmos dados. Se precisar alterar a inscrição, consulte o código anterior antes de descartá-lo."}
              </p>
            </section>
          ) : null}
          {preview ? (
            <p role="status" className="mt-4 text-sm font-semibold text-[#865667]">
              Prévia: não envia nem armazena candidaturas.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending || recoveredAttempt}
            className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-[#633846] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#7e4e5c] disabled:opacity-50"
          >
            <Send aria-hidden="true" className="h-5 w-5" />
            {sending
              ? "Enviando candidatura..."
              : recoveredAttempt
                ? "Resolva a tentativa anterior para continuar"
                : preview
                  ? "Simular envio"
                  : "Enviar minha inscrição"}
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-[#937a7d]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Seus dados de contato e endereço são protegidos. O envio não garante aprovação.
          </p>
        </div>
      </div>
    </form>
  );
}
