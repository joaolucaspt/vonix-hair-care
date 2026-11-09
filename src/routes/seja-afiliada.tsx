import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Heart, Sparkles, UsersRound } from "lucide-react";
import { Shell } from "@/components/site";
import { BRAZIL_STATES, HAIR_TYPES, affiliateApplicationSchema } from "@/lib/affiliate-application";
import {
  getAffiliateRecruitmentStatus,
  submitAffiliateApplication,
} from "@/lib/affiliate-functions";
import { SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/seja-afiliada")({
  head: () => ({
    meta: [
      { title: "Seja um afiliado Vonix Hair | Inscrições" },
      {
        name: "description",
        content:
          "Inscreva-se para participar da seleção de afiliadas Vonix Hair. Conte sua história, compartilhe suas redes e faça parte dessa oportunidade.",
      },
      { property: "og:title", content: "Seja um afiliado Vonix Hair" },
      {
        property: "og:description",
        content: "Sua paixão por cabelos pode fazer parte da nossa história. Envie sua inscrição.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/seja-afiliada" }],
  }),
  component: AffiliateApplicationPage,
});

type FormFields = {
  fullName: string;
  age: string;
  city: string;
  state: string;
  hairType: string;
  email: string;
  instagram: string;
  tiktok: string;
  motivation: string;
  website: string;
};
const initial: FormFields = {
  fullName: "",
  age: "",
  city: "",
  state: "",
  hairType: "",
  email: "",
  instagram: "",
  tiktok: "",
  motivation: "",
  website: "",
};
const fieldClass =
  "w-full min-h-12 rounded-xl border border-[#decfcb] bg-white px-4 py-3 text-base text-[#291d1f] outline-none transition focus:border-[#aa686b] focus:ring-2 focus:ring-[#ead1ce] disabled:opacity-60";
const labelClass = "mb-2 block text-sm font-semibold text-[#4c3235]";

function AffiliateApplicationPage() {
  const [form, setForm] = useState<FormFields>(initial);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [recruitment, setRecruitment] = useState<"loading" | "open" | "closed">("loading");

  useEffect(() => {
    let active = true;
    void getAffiliateRecruitmentStatus()
      .then(({ open }) => {
        if (active) setRecruitment(open ? "open" : "closed");
      })
      .catch(() => {
        if (active) setRecruitment("closed");
      });
    return () => {
      active = false;
    };
  }, []);

  function set<K extends keyof FormFields>(name: K, value: FormFields[K]) {
    setForm((old) => ({ ...old, [name]: value }));
    setErrors((old) => ({ ...old, [name]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || recruitment !== "open") return;
    setServerError("");
    const result = affiliateApplicationSchema.safeParse({
      ...form,
      age: Number(form.age),
      privacyAccepted: accepted,
    });
    if (!result.success) {
      const invalid: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "";
        if (!invalid[key]) invalid[key] = issue.message;
      }
      setErrors(invalid);
      return;
    }
    setSubmitting(true);
    try {
      const response = await submitAffiliateApplication({ data: result.data });
      if (response.ok) {
        setSent(true);
        setForm(initial);
      } else {
        setServerError(response.reason);
      }
    } catch {
      setServerError("Não foi possível enviar sua inscrição. Tente novamente mais tarde.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <div className="bg-[#faf6f2] text-[#311f23]">
        <section className="relative overflow-hidden bg-[#30191e] px-5 py-16 text-[#fff8f0] sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full bg-[#ad6669]/30 blur-[90px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-44 left-0 h-80 w-80 rounded-full bg-[#d1b18a]/20 blur-[95px]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e1bba4]/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-[#ecd2bd]">
                <Sparkles className="h-4 w-4" /> Programa de afiliados
              </div>
              <h1 className="max-w-2xl font-display text-5xl leading-[1.06] sm:text-6xl lg:text-7xl">
                SEJA UM <span className="italic text-[#e6bca7]">AFILIADO</span> VONIX HAIR
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#f4e5dd]">
                Seu amor por cabelos pode ir além de uma rotina de cuidados. Queremos conhecer
                criadoras que compartilham experiências reais e se identificam com o universo Vonix
                Hair.
              </p>
              <a
                href="#inscricao"
                className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#f5e0ce] px-7 py-3 text-sm font-bold text-[#361f25] transition hover:bg-white"
              >
                {recruitment === "open" ? "Quero me inscrever" : "Conhecer o programa"}{" "}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur-sm sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#f0cbaf]">
                Uma nova história começa aqui
              </p>
              <div className="mt-7 grid gap-7">
                <div className="flex gap-4">
                  <Heart className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Beleza com identidade</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      Um espaço para quem gosta de criar conteúdo de beleza e falar sobre cuidados
                      capilares.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <UsersRound className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Faça parte da comunidade</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      As inscrições selecionadas avançam para a próxima etapa e recebem as
                      orientações do programa.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Sparkles className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Oportunidade de comissão</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      Afiliadas aprovadas poderão divulgar produtos e obter comissões conforme as
                      regras do programa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="inscricao" className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[.24em] text-[#9e565e]">
              {recruitment === "open" ? "Inscrições abertas" : "Programa de afiliados"}
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">Queremos conhecer você.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#765c5d] sm:text-base">
              {recruitment === "open"
                ? "Preencha os campos abaixo para participar da seleção. A inscrição é gratuita e não garante aprovação. O programa é destinado a pessoas com 18 anos ou mais."
                : "O programa é destinado a pessoas com 18 anos ou mais. Consulte os canais oficiais da Vonix Hair para acompanhar a abertura das inscrições."}
            </p>
          </div>

          {recruitment !== "open" ? (
            <div
              role="status"
              className="mx-auto max-w-2xl rounded-[2rem] border border-[#e7d4cf] bg-white px-8 py-14 text-center shadow-[0_15px_70px_rgba(80,32,39,.08)]"
            >
              <Sparkles aria-hidden="true" className="mx-auto h-12 w-12 text-[#86535a]" />
              <h3 className="mt-5 font-display text-3xl sm:text-4xl">
                {recruitment === "loading"
                  ? "Verificando inscrições..."
                  : "Inscrições em preparação"}
              </h3>
              <p className="mt-4 leading-relaxed text-[#755b5e]">
                {recruitment === "loading"
                  ? "Estamos verificando a disponibilidade do cadastro."
                  : "O formulário ainda não está habilitado. Quando o programa estiver pronto para receber candidaturas, o cadastro aparecerá aqui."}
              </p>
              <Link
                to="/"
                className="mt-7 inline-flex rounded-full border border-[#b98e86] px-6 py-3 text-sm font-semibold"
              >
                Voltar para a loja
              </Link>
            </div>
          ) : sent ? (
            <div className="mx-auto max-w-2xl rounded-[2rem] border border-[#e7d4cf] bg-white px-8 py-14 text-center shadow-[0_15px_70px_rgba(80,32,39,.08)]">
              <CheckCircle2 className="mx-auto h-14 w-14 text-[#86535a]" />
              <h3 className="mt-5 font-display text-4xl">Inscrição enviada!</h3>
              <p className="mt-4 leading-relaxed text-[#755b5e]">
                Recebemos suas informações. Nossa equipe vai analisar seu perfil e, após a decisão,
                você receberá uma resposta por e-mail.
              </p>
              <Link
                to="/"
                className="mt-7 inline-flex rounded-full border border-[#b98e86] px-6 py-3 text-sm font-semibold"
              >
                Voltar para a loja
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => void submit(e)}
              className="mx-auto max-w-3xl rounded-[2rem] border border-[#eadbd6] bg-white px-5 py-8 shadow-[0_15px_70px_rgba(80,32,39,.08)] sm:px-10 sm:py-11"
            >
              <div className="mb-8 border-b border-[#f0e4df] pb-6">
                <h3 className="font-display text-3xl">Sua inscrição</h3>
                <p className="mt-2 text-sm text-[#765c5d]">
                  Todos os campos indicados com * são obrigatórios.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="affiliate-fullName">
                    Nome completo *
                  </label>
                  <input
                    id="affiliate-fullName"
                    required
                    maxLength={120}
                    autoComplete="name"
                    className={fieldClass}
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="Seu nome e sobrenome"
                  />
                  {errors["fullName"] && (
                    <p className="mt-1 text-xs text-red-700">{errors["fullName"]}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass} htmlFor="affiliate-age">
                    Idade *
                  </label>
                  <input
                    id="affiliate-age"
                    type="number"
                    min={18}
                    max={100}
                    required
                    inputMode="numeric"
                    className={fieldClass}
                    value={form.age}
                    onChange={(e) => set("age", e.target.value)}
                    placeholder="Sua idade"
                  />
                  {errors["age"] && (
                    <p className="mt-1 text-xs text-red-700">
                      Informe uma idade entre 18 e 100 anos.
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass} htmlFor="affiliate-hair">
                    Tipo de cabelo *
                  </label>
                  <select
                    id="affiliate-hair"
                    required
                    className={fieldClass}
                    value={form.hairType}
                    onChange={(e) => set("hairType", e.target.value)}
                  >
                    <option value="">Selecione seu tipo</option>
                    {HAIR_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="affiliate-city">
                    Cidade onde mora *
                  </label>
                  <input
                    id="affiliate-city"
                    required
                    maxLength={90}
                    autoComplete="address-level2"
                    className={fieldClass}
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Ex.: Belo Horizonte"
                  />
                  {errors["city"] && <p className="mt-1 text-xs text-red-700">{errors["city"]}</p>}
                </div>
                <div>
                  <label className={labelClass} htmlFor="affiliate-state">
                    Estado *
                  </label>
                  <select
                    id="affiliate-state"
                    required
                    autoComplete="address-level1"
                    className={fieldClass}
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                  >
                    <option value="">Selecione seu estado</option>
                    {BRAZIL_STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="affiliate-email">
                    E-mail para receber o resultado *
                  </label>
                  <input
                    id="affiliate-email"
                    type="email"
                    required
                    maxLength={180}
                    autoComplete="email"
                    className={fieldClass}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="voce@exemplo.com"
                  />
                  {errors["email"] && (
                    <p className="mt-1 text-xs text-red-700">{errors["email"]}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="affiliate-instagram">
                    Link do perfil no Instagram *
                  </label>
                  <input
                    id="affiliate-instagram"
                    type="url"
                    required
                    maxLength={240}
                    className={fieldClass}
                    value={form.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="https://www.instagram.com/seuperfil"
                  />
                  {errors["instagram"] && (
                    <p className="mt-1 text-xs text-red-700">{errors["instagram"]}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="affiliate-tiktok">
                    Link do perfil no TikTok *
                  </label>
                  <input
                    id="affiliate-tiktok"
                    type="url"
                    required
                    maxLength={240}
                    className={fieldClass}
                    value={form.tiktok}
                    onChange={(e) => set("tiktok", e.target.value)}
                    placeholder="https://www.tiktok.com/@seuperfil"
                  />
                  {errors["tiktok"] && (
                    <p className="mt-1 text-xs text-red-700">{errors["tiktok"]}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="affiliate-motivation">
                    Por que você deseja fazer parte do programa de afiliados Vonix Hair? *
                  </label>
                  <textarea
                    id="affiliate-motivation"
                    required
                    minLength={30}
                    maxLength={3000}
                    rows={6}
                    className={fieldClass}
                    value={form.motivation}
                    onChange={(e) => set("motivation", e.target.value)}
                    placeholder="Conte um pouco sobre você, seu conteúdo e sua conexão com o universo dos cabelos..."
                  />
                  <p className="mt-1 text-right text-xs text-[#806c6d]">
                    {form.motivation.length}/3000 caracteres
                  </p>
                  {errors["motivation"] && (
                    <p className="mt-1 text-xs text-red-700">
                      Escreva pelo menos 30 caracteres sobre sua motivação.
                    </p>
                  )}
                </div>
                <div
                  className="absolute -left-[10000px] h-px w-px overflow-hidden"
                  aria-hidden="true"
                >
                  <label htmlFor="affiliate-website">Website</label>
                  <input
                    id="affiliate-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#655052]">
                    <input
                      type="checkbox"
                      required
                      checked={accepted}
                      onChange={(e) => {
                        setAccepted(e.target.checked);
                        setErrors((old) => ({ ...old, privacyAccepted: "" }));
                      }}
                      className="mt-1 h-4 w-4 accent-[#8b5058]"
                    />
                    <span>
                      Li a{" "}
                      <Link
                        to="/$page"
                        params={{ page: "politica-de-privacidade" }}
                        className="font-semibold underline"
                      >
                        Política de Privacidade
                      </Link>{" "}
                      e autorizo o uso dos dados enviados para analisar minha candidatura e
                      comunicar o resultado. *
                    </span>
                  </label>
                  {errors["privacyAccepted"] && (
                    <p className="mt-1 text-xs text-red-700">Aceite a política para continuar.</p>
                  )}
                </div>
              </div>
              {serverError && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  {serverError}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#632e39] px-6 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#7c414c] disabled:opacity-60"
              >
                {submitting ? "Enviando inscrição..." : "ENVIAR INSCRIÇÃO"}{" "}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="mt-4 text-center text-xs leading-relaxed text-[#867173]">
                Seus dados serão utilizados exclusivamente para esta seleção e seu acompanhamento,
                conforme a política de privacidade.
              </p>
            </form>
          )}
        </section>
      </div>
    </Shell>
  );
}
