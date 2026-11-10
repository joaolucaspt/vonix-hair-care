import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AffiliateShell } from "@/components/affiliate-shell";
import { affiliateStatusRedirectUrl, vonixAffiliateAuth } from "@/lib/vonix-affiliate-auth";

export const Route = createFileRoute("/acompanhar-inscricao")({
  head: () => ({
    meta: [
      { title: "Acompanhar candidatura | Vonix Hair" },
      {
        name: "description",
        content:
          "Área privada de acompanhamento da sua candidatura ao programa de afiliadas Vonix Hair.",
      },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AffiliateApplicationTracker,
});

type ApplicationStatus = "pendente" | "aprovada" | "recusada";
type OwnApplication = {
  application_id: string;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
};

const statusUi = {
  pendente: {
    title: "Candidatura em análise",
    copy: "Recebemos sua inscrição. A equipe Vonix Hair avaliará as informações enviadas. Nenhuma aprovação é automática.",
    Icon: Clock3,
    tone: "bg-amber-50 text-amber-800 border-amber-200",
  },
  aprovada: {
    title: "Candidatura aprovada",
    copy: "Seu perfil foi aprovado na etapa de seleção. Aguarde a comunicação oficial da equipe para conhecer as condições da eventual parceria.",
    Icon: CheckCircle2,
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  recusada: {
    title: "Candidatura não selecionada",
    copy: "Sua candidatura foi avaliada e não foi selecionada nesta etapa. Você pode continuar acompanhando a Vonix Hair como cliente e integrante da nossa comunidade.",
    Icon: XCircle,
    tone: "bg-stone-50 text-stone-700 border-stone-200",
  },
} as const;

export function AffiliateApplicationTracker() {
  const [signedEmail, setSignedEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [application, setApplication] = useState<OwnApplication | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setError("");
    setApplication(null);
    try {
      // getUser checks the Auth server; do not trust an unvalidated local token.
      const userResult = await vonixAffiliateAuth.auth.getUser();
      const verified = userResult.data.user;
      if (userResult.error || !verified?.email || !verified.email_confirmed_at) {
        setSignedEmail("");
        return;
      }
      setSignedEmail(verified.email);
      // PostgreSQL RLS matches only the verified JWT e-mail. No names,
      // documents, phone numbers or other candidates' details are returned.
      const response = await vonixAffiliateAuth
        .from("vonix_affiliate_portal_status")
        .select("application_id,status,submitted_at,reviewed_at")
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (response.error) {
        setError("Não foi possível consultar sua solicitação agora. Tente novamente.");
        return;
      }
      const item = response.data?.[0] as OwnApplication | undefined;
      if (item && ["pendente", "aprovada", "recusada"].includes(item.status)) {
        setApplication(item);
      }
    } catch {
      setError("Não foi possível estabelecer uma conexão segura para consultar sua candidatura.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const {
      data: { subscription },
    } = vonixAffiliateAuth.auth.onAuthStateChange(() => {
      // Defer the Auth network request outside the SDK callback's lock.
      queueMicrotask(() => {
        void refresh();
      });
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  async function requestLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const normalized = loginEmail.trim().toLowerCase();
      const response = await vonixAffiliateAuth.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: affiliateStatusRedirectUrl(),
        },
      });
      if (response.error) {
        setError(
          "Não foi possível enviar o acesso. Confira o e-mail usado no cadastro ou tente mais tarde.",
        );
      } else {
        setNotice(
          "Se este e-mail possui uma conta de candidatura, confira a mensagem de acesso enviada a ele.",
        );
      }
    } catch {
      setError("Falha de conexão ao solicitar acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !/^\d{6,8}$/.test(code)) return;
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await vonixAffiliateAuth.auth.verifyOtp({
        email: loginEmail.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (authError) setError("O código informado é inválido ou expirou.");
      else {
        setCode("");
        await refresh();
      }
    } catch {
      setError("Não foi possível validar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setApplication(null);
    setSignedEmail("");
    setCode("");
    setNotice("");
    await vonixAffiliateAuth.auth.signOut();
  }

  const show = application ? statusUi[application.status] : null;
  const Icon = show?.Icon;
  return (
    <AffiliateShell mode="account">
      <div className="relative isolate min-h-[75vh] bg-[#faf5f0] px-5 py-16 text-[#392832] sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#f0dfe1] to-transparent"
        />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#e4c7cd] bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#7c495b]">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" /> Área privativa de candidatas
            </div>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
              Acompanhe sua inscrição
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-[#755d63] sm:text-base">
              Um espaço exclusivo para quem já enviou uma candidatura à Vonix Hair. Sua solicitação
              continua disponível para acompanhamento, inclusive após uma decisão.
            </p>
          </div>
          <section className="rounded-[2rem] border border-[#e8d7d3] bg-white p-6 shadow-[0_18px_70px_rgba(72,31,43,.08)] sm:p-10">
            {checking ? (
              <p role="status" className="flex items-center gap-3 text-sm text-[#73545e]">
                <Clock3 className="h-5 w-5" /> Verificando sua sessão de maneira segura...
              </p>
            ) : signedEmail ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#926d75]">
                      Conta verificada
                    </p>
                    <p className="mt-1 break-all font-semibold">{signedEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="min-h-11 rounded-full border border-[#e0cace] px-5 text-sm font-semibold text-[#6a4050]"
                  >
                    Sair
                  </button>
                </div>
                {show && Icon ? (
                  <div className="mt-7">
                    <div
                      role="status"
                      className={"flex items-start gap-4 rounded-2xl border p-5 " + show.tone}
                    >
                      <Icon aria-hidden="true" className="mt-1 h-7 w-7 shrink-0" />
                      <div>
                        <h2 className="font-display text-2xl">{show.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed">{show.copy}</p>
                      </div>
                    </div>
                    <dl className="mt-6 grid gap-4 border-t border-[#f0e5e4] pt-6 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[#916c75]">Inscrição recebida</dt>
                        <dd className="mt-1 font-semibold">
                          {new Date(application!.submitted_at).toLocaleDateString("pt-BR")}
                        </dd>
                      </div>
                      {application!.reviewed_at && (
                        <div>
                          <dt className="text-[#916c75]">Analisada em</dt>
                          <dd className="mt-1 font-semibold">
                            {new Date(application!.reviewed_at!).toLocaleDateString("pt-BR")}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ) : (
                  <p className="mt-7 rounded-xl border border-[#eddad7] bg-[#fffaf8] p-5 text-sm text-[#73545e]">
                    Não há uma candidatura vinculada a este e-mail verificado. Apenas pessoas que
                    concluíram o formulário podem acompanhar uma solicitação.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#633847] px-6 text-sm font-bold text-white"
                >
                  Atualizar acompanhamento <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <LockKeyhole aria-hidden="true" className="h-9 w-9 shrink-0 text-[#865766]" />
                  <div>
                    <h2 className="font-display text-2xl">Entrar com o e-mail da candidatura</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#80676b]">
                      Somente uma conta vinculada a um formulário enviado pode exibir uma inscrição.
                      Enviaremos uma verificação ao e-mail cadastrado, sem usar o login da loja.
                    </p>
                  </div>
                </div>
                <form onSubmit={requestLogin} className="mt-7">
                  <label htmlFor="affiliate-tracker-email" className="text-sm font-semibold">
                    E-mail utilizado na inscrição
                  </label>
                  <input
                    id="affiliate-tracker-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={180}
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="mt-2 min-h-12 w-full rounded-xl border border-[#d9c3c8] bg-white px-4 outline-none focus-visible:ring-2 focus-visible:ring-[#9a6776]"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#633847] px-5 font-bold text-white disabled:opacity-60"
                  >
                    <Mail className="h-4 w-4" />{" "}
                    {loading ? "Enviando..." : "Receber acesso por e-mail"}
                  </button>
                </form>
                {notice && (
                  <p
                    role="status"
                    className="mt-5 rounded-xl bg-[#f1eee7] p-4 text-sm text-[#625049]"
                  >
                    {notice}
                  </p>
                )}
                <form onSubmit={verifyCode} className="mt-6 border-t border-[#efe2e0] pt-5">
                  <label htmlFor="affiliate-tracker-code" className="text-sm font-semibold">
                    Recebeu um código no e-mail?
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="affiliate-tracker-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6,8}"
                      minLength={6}
                      maxLength={8}
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, "").slice(0, 8))
                      }
                      placeholder="Código de verificação"
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#d9c3c8] px-4"
                    />
                    <button
                      type="submit"
                      disabled={loading || !/^\d{6,8}$/.test(code)}
                      className="min-h-11 rounded-xl border border-[#b99fa5] px-5 text-sm font-bold text-[#653a49] disabled:opacity-50"
                    >
                      Validar código
                    </button>
                  </div>
                </form>
                <p className="mt-4 text-xs leading-relaxed text-[#927e82]">
                  Se recebeu um link de acesso, abra-o neste navegador. Nunca forneça seus códigos a
                  terceiros.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
            )}
          </section>
          <p className="mt-6 text-center text-sm text-[#846a71]">
            <Link to="/seja-afiliada" className="font-semibold underline underline-offset-4">
              Voltar ao programa de afiliadas
            </Link>
          </p>
        </div>
      </div>
    </AffiliateShell>
  );
}
