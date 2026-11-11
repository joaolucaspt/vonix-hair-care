import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, MapPin, Send, ShieldCheck, Instagram } from "lucide-react";
import { affiliateSimpleSchema } from "@/lib/affiliate-simple";
import { track } from "@/lib/analytics";
import { submitSimpleAffiliateApplication } from "@/lib/affiliate-functions";
import { WIZARD_BRAZIL_STATES, onlyDigits } from "@/lib/affiliate-wizard";

type Key =
  | "fullName"
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

const fields: Record<Key, string> = {
  fullName: "",
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
      url.search ||
      url.hash ||
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
  const [message, setMessage] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const zipRequest = useRef(0);
  const submitting = useRef(false);
  const dirty = Object.values(values).some(Boolean) || accepted || !!trap;

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
    if (key === "postalCode") zipRequest.current++;
    const value =
      key === "postalCode"
        ? onlyDigits(raw)
            .slice(0, 8)
            .replace(/^(\d{5})(\d)/, "$1-$2")
        : key === "instagram" || key === "tiktok"
          ? raw.slice(0, 240)
          : raw;
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setMessage("");
  }

  async function lookupPostalCode() {
    const digits = onlyDigits(values.postalCode);
    if (digits.length !== 8 || zipLoading) return;
    const request = ++zipRequest.current;
    setZipLoading(true);
    try {
      const res = await fetch("https://viacep.com.br/ws/" + digits + "/json/", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (typeof data !== "object" || !data || "erro" in data) return;
      const obj = data as Record<string, unknown>;
      const text = (key: string, limit: number) => {
        const v = obj[key];
        return typeof v === "string" && v.trim().length <= limit ? v.trim() : "";
      };
      const uf = text("uf", 2).toUpperCase();
      if (!WIZARD_BRAZIL_STATES.some((state) => state === uf)) return;
      setValues((prev) => {
        if (zipRequest.current !== request || onlyDigits(prev.postalCode) !== digits) return prev;
        return {
          ...prev,
          street: prev.street || text("logradouro", 120),
          district: prev.district || text("bairro", 90),
          city: prev.city || text("localidade", 90),
          state: prev.state || uf,
        };
      });
    } catch {
      // CEP lookup only assists; the full address can always be entered manually.
    } finally {
      if (zipRequest.current === request) setZipLoading(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending || submitting.current || sent) return;
    const parsed = affiliateSimpleSchema.safeParse({
      ...values,
      instagram: normalizeSocial(values.instagram, "instagram"),
      tiktok: normalizeSocial(values.tiktok, "tiktok"),
      instagramFollowers: /^\d+$/.test(values.instagramFollowers)
        ? Number(values.instagramFollowers)
        : NaN,
      tiktokFollowers: /^\d+$/.test(values.tiktokFollowers) ? Number(values.tiktokFollowers) : NaN,
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
    submitting.current = true;
    setSending(true);
    setMessage("");
    try {
      const result = await submitSimpleAffiliateApplication({ data: parsed.data });
      if (result.ok) {
        // Count only a persisted application; no candidate personal information is sent.
        track("sign_up", { method: "affiliate_application" });
        setSent(true);
        setValues({ ...fields });
        setAccepted(false);
      } else {
        setMessage(result.reason);
      }
    } catch {
      setMessage("Não foi possível enviar sua inscrição. Tente novamente.");
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
          Obrigada pelo interesse na Vonix Hair. Nossa equipe analisará seu Instagram e TikTok e,
          caso necessário, entrará em contato pelo telefone informado.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-sm text-[#7c6369]">
          A candidatura não garante aprovação ou parceria. Não será enviado código por e-mail, pois
          este formulário não solicita e-mail.
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
      type={key === "phone" ? "tel" : "text"}
      label={label}
      value={values[key]}
      onChange={(value) => update(key, value)}
      error={errors[key]}
      {...options}
    />
  );

  return (
    <form
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
              disabled={zipLoading || onlyDigits(values.postalCode).length !== 8}
              className="min-h-12 rounded-xl border border-[#c9aeb2] px-5 text-sm font-semibold text-[#633a43] disabled:opacity-50"
            >
              {zipLoading ? "Buscando CEP..." : "Buscar CEP"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            {field("street", "Rua / Avenida", {
              placeholder: "Nome do logradouro",
              maxLength: 120,
              autoComplete: "address-line1",
            })}
            {field("number", "Número", { placeholder: "123", maxLength: 15 })}
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
                Informe o @ ou link do perfil e a quantidade atual de seguidores.
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
            {field("tiktok", "TikTok", {
              placeholder: "@seuperfil",
              maxLength: 240,
              autoComplete: "off",
            })}
            {field("tiktokFollowers", "Seguidores no TikTok", {
              placeholder: "Ex.: 900",
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
              required
              checked={accepted}
              onChange={(e) => {
                setAccepted(e.target.checked);
                setErrors((old) => ({ ...old, privacyAccepted: "" }));
              }}
              className="mt-1 h-4 w-4 accent-[#633a43]"
            />
            Autorizo o uso destes dados para análise da candidatura e eventual contato sobre o
            programa de afiliadas, conforme a política de privacidade da Vonix Hair.
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
          {preview ? (
            <p role="status" className="mt-4 text-sm font-semibold text-[#865667]">
              Prévia: não envia nem armazena candidaturas.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending}
            className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-[#633846] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#7e4e5c] disabled:opacity-50"
          >
            <Send aria-hidden="true" className="h-5 w-5" />
            {sending
              ? "Enviando candidatura..."
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
