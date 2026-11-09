import { useEffect, useRef, useState, type FormEvent, type HTMLInputTypeAttribute } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { affiliateApplicationSchema } from "@/lib/affiliate-application";
import { submitAffiliateApplication } from "@/lib/affiliate-functions";
import {
  affiliateWizardSchema,
  buildAffiliatePayload,
  stepErrors,
  onlyDigits,
  instagramProfileUrl,
  validInstagramUsername,
  WIZARD_STEPS,
  CONTENT_NICHES,
  INSTAGRAM_FOLLOWERS,
  TIKTOK_FOLLOWERS,
  PREFERRED_VONIX_LINES,
  WIZARD_HAIR_TYPES,
  WIZARD_BRAZIL_STATES,
  DEPENDENT_CHOICES,
  type AffiliateWizardDraft,
  type WizardKey,
} from "@/lib/affiliate-wizard";

const inputClass =
  "w-full min-h-12 rounded-xl border border-[#dfd0cb] bg-white px-4 py-3 text-base text-[#342428] outline-none transition focus:border-[#995e65] focus:ring-2 focus:ring-[#f0d9d9] disabled:opacity-60";
const labelClass = "mb-2 block text-sm font-semibold leading-relaxed text-[#50393d]";
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#673541] px-8 py-3 text-sm font-bold text-white transition hover:bg-[#844a55] disabled:cursor-not-allowed disabled:opacity-50";
const muted =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#dcc8c6] px-6 py-3 text-sm font-semibold text-[#68464e] transition hover:bg-[#fff6f3]";

const initial: AffiliateWizardDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  emailConfirmation: "",
  cpf: "",
  cnpj: "",
  birthDate: "",
  birthCity: "",
  postalCode: "",
  city: "",
  state: "",
  street: "",
  district: "",
  number: "",
  complement: "",
  instagramUsername: "",
  tiktokUsername: "",
  xUsername: "",
  youtubeUsername: "",
  niche: "",
  otherNiche: "",
  instagramFollowers: "",
  tiktokFollowers: "",
  municipalRegistration: "",
  municipalNumber: "",
  dependents: "",
  preferredLine: "",
  couponSuggestion: "",
  hairType: "",
  termsAccepted: false,
};

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required = true,
  type = "text",
  placeholder,
  maxLength,
  autoComplete,
  onBlur,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  required?: boolean | undefined;
  type?: HTMLInputTypeAttribute | undefined;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
  autoComplete?: string | undefined;
  onBlur?: (() => void) | undefined;
  inputMode?: "numeric" | "text" | "email" | undefined;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={"wizard-" + id}>
        {label}{" "}
        {required && (
          <span className="text-[#a34e5c]" aria-label="obrigatório">
            *
          </span>
        )}
      </label>
      <input
        id={"wizard-" + id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onBlur={onBlur}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "wizard-error-" + id : undefined}
        className={inputClass + (error ? " border-red-500" : "")}
      />
      {error && (
        <p id={"wizard-error-" + id} role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  error?: string | undefined;
  required?: boolean | undefined;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={"wizard-" + id}>
        {label}{" "}
        {required && (
          <span className="text-[#a34e5c]" aria-label="obrigatório">
            *
          </span>
        )}
      </label>
      <select
        id={"wizard-" + id}
        className={inputClass}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "wizard-error-" + id : undefined}
      >
        <option value="">Selecione uma opção</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <p id={"wizard-error-" + id} role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function maskPhone(value: string) {
  const v = onlyDigits(value).slice(0, 11);
  if (!v) return "";
  if (v.length <= 2) return "(" + v;
  if (v.length <= 7) return "(" + v.slice(0, 2) + ") " + v.slice(2);
  return "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
}
function maskCpf(value: string) {
  const v = onlyDigits(value).slice(0, 11);
  return v
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)$/, ".$1-$2");
}
function maskZip(value: string) {
  const v = onlyDigits(value).slice(0, 8);
  return v.length > 5 ? v.slice(0, 5) + "-" + v.slice(5) : v;
}

export function AffiliateWizard({ preview = false }: { preview?: boolean }) {
  const [values, setValues] = useState<AffiliateWizardDraft>({ ...initial });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  // Synchronous lock prevents a second POST before React updates the disabled button.
  const sendingRef = useRef(false);
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const pendingFieldFocus = useRef<WizardKey | null>(null);
  const zipLookupId = useRef(0);

  // Focus after React has rendered the destination stage, not the old heading.
  useEffect(() => {
    if (!navigated.current) return;
    const fieldToFocus = pendingFieldFocus.current;
    pendingFieldFocus.current = null;
    const target = fieldToFocus ? document.getElementById("wizard-" + fieldToFocus) : null;
    if (target) target.focus();
    else heading.current?.focus();
    heading.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [step]);

  useEffect(
    () => () => {
      zipLookupId.current += 1;
    },
    [],
  );

  function update(key: WizardKey, value: string | boolean) {
    if (key === "postalCode") {
      // Stale asynchronous lookups must not overwrite a manually changed address.
      zipLookupId.current += 1;
      setZipLoading(false);
    }
    setValues((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: "" }));
    setMessage("");
  }

  const value = (key: WizardKey) => String(values[key] ?? "");
  const field = (
    key: WizardKey,
    label: string,
    opts: {
      placeholder?: string | undefined;
      required?: boolean | undefined;
      type?: HTMLInputTypeAttribute | undefined;
      maxLength?: number | undefined;
      autoComplete?: string | undefined;
      inputMode?: "numeric" | "text" | "email" | undefined;
      onBlur?: (() => void) | undefined;
      transform?: (v: string) => string;
    } = {},
  ) => (
    <Field
      id={key}
      label={label}
      value={value(key)}
      onChange={(v) => update(key, opts.transform ? opts.transform(v) : v)}
      error={errors[key]}
      {...opts}
    />
  );
  const select = (key: WizardKey, label: string, options: readonly string[], required = true) => (
    <SelectField
      id={key}
      label={label}
      value={value(key)}
      onChange={(v) => update(key, v)}
      error={errors[key]}
      options={options}
      required={required}
    />
  );
  function moveTo(next: number) {
    navigated.current = true;
    zipLookupId.current += 1;
    setZipLoading(false);
    setStep(next);
    setErrors({});
    setMessage("");
  }

  async function lookupPostalCode() {
    const zip = onlyDigits(value("postalCode"));
    if (preview || zip.length !== 8 || zipLoading) return;
    const requestId = ++zipLookupId.current;
    setZipLoading(true);
    try {
      // Public Brazilian postal code lookup; never sends CPF/name/email or address number.
      const response = await fetch("https://viacep.com.br/ws/" + zip + "/json/", {
        signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        erro?: boolean;
        localidade?: string;
        uf?: string;
        logradouro?: string;
        bairro?: string;
      };
      if (data.erro) return;
      setValues((old) => {
        if (requestId !== zipLookupId.current || onlyDigits(String(old.postalCode)) !== zip) {
          return old;
        }
        return {
          ...old,
          city: old.city || data.localidade || "",
          state: old.state || data.uf || "",
          street: old.street || data.logradouro || "",
          district: old.district || data.bairro || "",
        };
      });
    } catch {
      // Postal-code lookup is optional: manual entry remains available.
    } finally {
      if (requestId === zipLookupId.current) setZipLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || sendingRef.current || sent) return;
    const localErrors = stepErrors(step, values);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      const firstKey = Object.keys(localErrors)[0];
      document.getElementById("wizard-" + firstKey)?.focus();
      return;
    }
    if (step < 4) return moveTo(step + 1);

    const parsed = affiliateWizardSchema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const key = String(issue?.path[0] ?? "");
      const targetStep = WIZARD_STEPS.findIndex(
        (_, index) => stepErrors(index, values)[key] !== undefined,
      );
      if (targetStep >= 0) {
        pendingFieldFocus.current = key as WizardKey;
        moveTo(targetStep);
      }
      setErrors({ [key]: issue?.message ?? "Revise este campo." });
      return;
    }

    if (preview) {
      setMessage("Esta é uma prévia interativa. Sua candidatura não foi enviada ou armazenada.");
      return;
    }
    const payload = affiliateApplicationSchema.safeParse({
      ...buildAffiliatePayload(parsed.data),
      website,
    });
    if (!payload.success) {
      setMessage("Não foi possível validar a candidatura. Revise os campos anteriores.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setMessage("");
    try {
      const response = await submitAffiliateApplication({ data: payload.data });
      if (response.ok) {
        setSent(true);
        setValues({ ...initial });
      } else {
        setMessage(response.reason);
      }
    } catch {
      setMessage("Não foi possível enviar a candidatura. Tente novamente mais tarde.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (sent)
    return (
      <div
        role="status"
        className="rounded-[2rem] border border-[#eadbd6] bg-white px-8 py-14 text-center shadow-xl"
      >
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#356b54]" />
        <h3 className="mt-5 font-display text-4xl">Candidatura recebida!</h3>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-[#745a61]">
          A equipe Vonix Hair analisará seu perfil. O envio não garante aprovação, cupom, comissão
          ou recebimento de produtos.
        </p>
        <Link to="/" className={muted + " mt-7"}>
          Voltar à loja
        </Link>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#eadbd6] bg-white shadow-[0_15px_70px_rgba(80,32,39,.08)]">
      <div className="border-b border-[#f1e6e1] bg-[#fdf9f7] px-5 py-7 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#efe0dc] px-4 py-2 text-xs font-bold uppercase tracking-[.15em] text-[#763f49]">
            <Sparkles className="h-4 w-4" /> Inscrição Vonix Hair
          </span>
          <span className="text-sm font-bold text-[#79565c]">Passo {step + 1} de 5</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step + 1}
          aria-label="Progresso do cadastro"
          className="mt-5 h-2 overflow-hidden rounded-full bg-[#ecdeda]"
        >
          <div
            className="h-full rounded-full bg-[#8d5962] transition-all"
            style={{ width: (step + 1) * 20 + "%" }}
          />
        </div>
        <div className="mt-4 hidden grid-cols-5 gap-2 sm:grid">
          {WIZARD_STEPS.map((item, index) => (
            <button
              key={item.title}
              type="button"
              disabled={index >= step}
              onClick={() => moveTo(index)}
              aria-current={index === step ? "step" : undefined}
              className={
                "truncate text-left text-xs font-semibold " +
                (index <= step ? "text-[#673541]" : "text-[#ad9396]")
              }
            >
              {String(index + 1).padStart(2, "0")} · {item.title}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        noValidate
        className="px-5 py-8 sm:px-10 sm:py-10"
      >
        <div className="mb-8">
          <h3 ref={heading} tabIndex={-1} className="font-display text-3xl sm:text-4xl">
            {WIZARD_STEPS[step]!.title}
          </h3>
          <p className="mt-2 text-sm text-[#80666b]">{WIZARD_STEPS[step]!.subtitle}</p>
          <p className="mt-2 text-xs text-[#9a777d]">Campos marcados com * são obrigatórios.</p>
        </div>

        {step === 0 && (
          <div className="space-y-8">
            <div className="grid gap-5 sm:grid-cols-2">
              {field("firstName", "Primeiro Nome", {
                placeholder: "Digite seu nome",
                autoComplete: "given-name",
                maxLength: 70,
              })}
              {field("lastName", "Sobrenome", {
                placeholder: "Digite seu sobrenome",
                autoComplete: "family-name",
                maxLength: 70,
              })}
              {field("phone", "Celular", {
                placeholder: "(31) 99999-9999",
                inputMode: "numeric",
                autoComplete: "tel",
                transform: maskPhone,
              })}
              {field("email", "E-mail", {
                type: "email",
                placeholder: "voce@exemplo.com",
                autoComplete: "email",
              })}
              {field("emailConfirmation", "Confirmar e-mail", {
                type: "email",
                placeholder: "Confirme seu e-mail",
                autoComplete: "off",
              })}
              {field("cpf", "CPF", {
                placeholder: "000.000.000-00",
                inputMode: "numeric",
                autoComplete: "off",
                transform: maskCpf,
              })}
              {field("cnpj", "CNPJ", {
                required: false,
                placeholder: "Opcional",
                inputMode: "numeric",
                maxLength: 18,
              })}
              {field("birthDate", "Data de nascimento", { type: "date", autoComplete: "bday" })}
              {field("birthCity", "Cidade de nascimento", { placeholder: "Onde você nasceu?" })}
            </div>
            <div className="border-t border-[#f2e8e5] pt-7">
              <h4 className="mb-5 inline-flex items-center gap-2 font-display text-2xl">
                <MapPin className="h-5 w-5 text-[#935969]" /> Endereço
              </h4>
              <div className="grid gap-5 sm:grid-cols-2">
                {field("postalCode", "CEP", {
                  placeholder: "00000-000",
                  inputMode: "numeric",
                  transform: maskZip,
                  onBlur: () => void lookupPostalCode(),
                })}
                <div className="flex items-end text-xs text-[#92777b]">
                  {zipLoading
                    ? "Consultando CEP..."
                    : "Preenchimento automático opcional. Você pode corrigir os dados."}
                </div>
                {field("city", "Cidade", { placeholder: "Cidade onde mora" })}
                {select("state", "Estado", WIZARD_BRAZIL_STATES)}
                {field("street", "Logradouro", { placeholder: "Rua, avenida, travessa..." })}
                {field("district", "Bairro", { placeholder: "Seu bairro" })}
                {field("number", "Número", { placeholder: "Número do endereço", maxLength: 15 })}
                {field("complement", "Complemento", {
                  required: false,
                  placeholder: "Apto, casa, bloco (opcional)",
                })}
              </div>
            </div>
            <div className="border-t border-[#f2e8e5] pt-7">
              <h4 className="mb-5 font-display text-2xl">Perfis nas redes sociais</h4>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {field("instagramUsername", "Usuário do instagram", {
                    placeholder: "@seuusuario",
                    maxLength: 31,
                  })}
                  {validInstagramUsername(value("instagramUsername")) && (
                    <a
                      href={instagramProfileUrl(value("instagramUsername"))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[#8e4f5d] underline"
                    >
                      Conferir link do perfil <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <p className="mt-2 text-xs text-[#96797d]">
                    A conferência abre o perfil informado; não confirma automaticamente a
                    titularidade.
                  </p>
                </div>
                {field("tiktokUsername", "Usuário do Tiktok", {
                  required: false,
                  placeholder: "@seuusuario",
                  maxLength: 31,
                })}
                {field("xUsername", "Usuário do X", {
                  required: false,
                  placeholder: "@seuusuario",
                })}
                {field("youtubeUsername", "Usuário do youtube", {
                  required: false,
                  placeholder: "@seucanal",
                })}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            {select(
              "niche",
              "Seus conteúdos se encaixam mais em qual desses nichos?",
              CONTENT_NICHES,
            )}
            {values.niche === "Outro" &&
              field("otherNiche", "Seu conteúdo se encaixa em outro nicho? Qual", {
                placeholder: "Descreva seu outro nicho",
              })}
            {select(
              "instagramFollowers",
              "Qual é o seu número de seguidores no Instagram?",
              INSTAGRAM_FOLLOWERS,
              false,
            )}
            {select(
              "tiktokFollowers",
              "Qual é o seu número de seguidores no TikTok?",
              TIKTOK_FOLLOWERS,
            )}
            <p className="rounded-xl bg-[#fbf5f2] p-4 text-xs leading-relaxed text-[#876b71]">
              As faixas são autodeclaradas. A análise da equipe também poderá considerar a qualidade
              e a originalidade dos conteúdos.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {select("municipalRegistration", "Possui Inscrição Municipal?", ["sim", "nao"])}
            {values.municipalRegistration === "sim" &&
              field("municipalNumber", "Se sim, qual é o número?", {
                placeholder: "Número da inscrição municipal",
                maxLength: 40,
              })}
            {select("dependents", "Você tem dependentes?", DEPENDENT_CHOICES)}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {select(
              "preferredLine",
              "Com qual linha Vonix Hair você mais se identifica?",
              PREFERRED_VONIX_LINES,
            )}
            {field("couponSuggestion", "Qual seria o nome ideal para o seu cupom?", {
              placeholder: "Ex.: MARINA10",
              maxLength: 30,
              transform: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
            })}
            <p className="rounded-xl bg-[#fbf5f2] p-4 text-xs leading-relaxed text-[#876b71]">
              Evite códigos comuns e finalize sua sugestão com <strong>10</strong>, como MARINA10. O
              nome é apenas uma preferência: não representa desconto ou comissão aprovada e será
              conferido pela equipe se sua inscrição avançar.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            {select("hairType", "Qual é o seu tipo de cabelo?", WIZARD_HAIR_TYPES)}
            <div className="rounded-2xl border border-[#e7d8d1] bg-[#fcf8f5] p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#80505a]" />
                <div>
                  <h4 className="font-display text-2xl">Termos e aceite</h4>
                  <p className="mt-3 text-sm leading-relaxed text-[#755e63]">
                    Confirmo que tenho 18 anos ou mais e que os dados informados são verdadeiros.
                    Autorizo a Vonix Hair a usar minhas informações exclusivamente para avaliar a
                    candidatura e comunicar uma decisão. A inscrição não garante aprovação, cupons,
                    recebimento de produtos ou comissões. Condições comerciais dependerão de
                    regulamento e eventual contratação posterior.
                  </p>
                  <p className="mt-3 text-sm text-[#755e63]">
                    Consulte a{" "}
                    <Link
                      to="/$page"
                      params={{ page: "politica-de-privacidade" }}
                      className="font-semibold underline"
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </p>
                </div>
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-relaxed">
                <input
                  id="wizard-termsAccepted"
                  type="checkbox"
                  required
                  checked={values["termsAccepted"] === true}
                  onChange={(e) => update("termsAccepted", e.target.checked)}
                  aria-invalid={Boolean(errors["termsAccepted"])}
                  className="mt-1 h-5 w-5 accent-[#7a4350]"
                />
                <span>
                  Li e concordo com os termos de participação e com o tratamento de dados descrito
                  na política de privacidade. <span className="text-[#9d4f5e]">*</span>
                </span>
              </label>
              {errors["termsAccepted"] && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {errors["termsAccepted"]}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Honeypot never appears to a human and is ignored on the client. */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <input
            tabIndex={-1}
            autoComplete="off"
            name="website"
            aria-label="Website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>

        {message && (
          <p
            role="status"
            className="mt-7 rounded-xl border border-[#eac5c2] bg-[#fff4f0] p-4 text-sm text-[#854b52]"
          >
            {message}
          </p>
        )}

        {preview && (
          <p
            role="status"
            className="mt-7 rounded-xl border border-[#e6d0aa] bg-[#fff8e9] p-4 text-sm font-medium text-[#82632d]"
          >
            <LockKeyhole className="mr-2 inline-block h-4 w-4" />
            Prévia: inscrições fechadas. Nenhuma candidatura será enviada ou salva.
          </p>
        )}

        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e6e0] pt-7">
          {step > 0 ? (
            <button type="button" className={muted} onClick={() => moveTo(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          ) : (
            <span className="text-xs leading-relaxed text-[#977b80]">O cadastro é gratuito.</span>
          )}
          <button type="submit" className={primary} disabled={sending}>
            {sending
              ? "Enviando..."
              : step < 4
                ? "Avançar"
                : preview
                  ? "Simular finalização"
                  : "Enviar candidatura"}
            {!sending && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
