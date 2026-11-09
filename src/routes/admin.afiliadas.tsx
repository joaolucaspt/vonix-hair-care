import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { LOGO } from "@/components/site";
import {
  getAffiliateAdminSession,
  getAffiliateApplications,
  loginAffiliateAdmin,
  logoutAffiliateAdmin,
  reviewAffiliateApplication,
} from "@/lib/affiliate-functions";
import type {
  AffiliateApplicationRecord,
  AffiliateStatus,
  AffiliateMailStatus,
} from "@/lib/affiliate-application";
import type {
  AffiliateMailCounters,
  AffiliateListStatus,
  AffiliateMailStatus as AffiliateQueueFilter,
} from "@/lib/affiliate-applications.server";

export const Route = createFileRoute("/admin/afiliadas")({
  head: () => ({
    meta: [
      { title: "Seleção de afiliadas | Vonix Hair" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AffiliateAdminPage,
});

const STATUS: { key: AffiliateListStatus; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "recusada", label: "Recusadas" },
  { key: "todas", label: "Notificações" },
];
const PER_PAGE = 40;
const MAIL_STATUS: { key: keyof AffiliateMailCounters; label: string; color: string }[] = [
  { key: "pendente", label: "Aguardando", color: "text-[#a16b23]" },
  { key: "processando", label: "Processando", color: "text-[#4b709f]" },
  { key: "enviado", label: "Aceitos", color: "text-[#2c7859]" },
  { key: "falhou", label: "Falhas", color: "text-[#b14a4a]" },
  { key: "incerto", label: "Incertos", color: "text-[#995d78]" },
];
const statusStyle: Record<AffiliateStatus, string> = {
  pendente: "bg-amber-50 text-amber-800",
  aprovada: "bg-emerald-50 text-emerald-800",
  recusada: "bg-slate-100 text-slate-700",
};
const mailLabels: Record<AffiliateMailStatus, string> = {
  pendente: "E-mail aguardando envio",
  processando: "E-mail em processamento",
  enviado: "E-mail enviado",
  falhou: "Falha no envio — verificar",
  incerto: "Envio incerto — conciliar antes de reenviar",
};

function safeProfileLink(value: string | null | undefined, platform: "instagram" | "tiktok") {
  try {
    if (!value) return null;
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      url.protocol !== "https:" ||
      host !== (platform === "instagram" ? "instagram.com" : "tiktok.com")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function AffiliateAdminPage() {
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<AffiliateListStatus>("pendente");
  const [mailFilter, setMailFilter] = useState<AffiliateQueueFilter | null>(null);
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState<AffiliateApplicationRecord[]>([]);
  const [stats, setStats] = useState<Record<AffiliateStatus, number>>({
    pendente: 0,
    aprovada: 0,
    recusada: 0,
  });
  const [mailStats, setMailStats] = useState<AffiliateMailCounters>({
    pendente: 0,
    processando: 0,
    enviado: 0,
    falhou: 0,
    incerto: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Versions prevent any in-flight list or decision from restoring private data after logout.
  const sessionVersion = useRef(0);
  const loadVersion = useRef(0);

  function clearPrivateData() {
    setApplications([]);
    setStatus("pendente");
    setPage(0);
    setMailFilter(null);
    setSearch("");
    setSearchText("");
    setStats({ pendente: 0, aprovada: 0, recusada: 0 });
    setMailStats({ pendente: 0, processando: 0, enviado: 0, falhou: 0, incerto: 0 });
    setTotal(0);
    setWorkingId(null);
    setNotice("");
  }

  async function load(
    nextStatus = status,
    nextPage = page,
    nextSearch = search,
    nextMailFilter: AffiliateQueueFilter | null = mailFilter,
  ) {
    const requestId = ++loadVersion.current;
    const sessionId = sessionVersion.current;
    const isCurrent = () =>
      requestId === loadVersion.current && sessionId === sessionVersion.current;
    setLoading(true);
    setError("");
    try {
      const response = await getAffiliateApplications({
        data: {
          status: nextStatus,
          page: nextPage,
          search: nextSearch || undefined,
          mailStatus: nextMailFilter,
        },
      });
      if (!isCurrent()) return;
      if (!response.ok) {
        setError(response.reason);
        if (response.reason.includes("Acesso negado")) {
          setAuthorized(false);
          clearPrivateData();
        }
        return;
      }
      setAuthorized(true);
      setStatus(nextStatus);
      setMailFilter(nextMailFilter);
      setPage(nextPage);
      setSearch(nextSearch);
      setApplications(response.applications);
      setStats(response.stats);
      setMailStats(response.mailStats);
      setTotal(response.total);
    } catch {
      if (isCurrent()) setError("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const sessionRef = sessionVersion;
    const loadRef = loadVersion;
    void getAffiliateAdminSession()
      .then(async (session) => {
        if (active && session.authenticated) await load("pendente", 0, "");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
      // Invalidate work started by the initial session check when leaving this screen.
      sessionRef.current++;
      loadRef.current++;
    };
    // Session status is checked only on initial mount, not on each filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await loginAffiliateAdmin({ data: { password, otp } });
      setPassword("");
      setOtp("");
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await load("pendente", 0, "");
    } catch {
      setError("Não foi possível autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (loading && !authorized) return;
    // Clear sensitive information immediately, not after a network round-trip.
    sessionVersion.current++;
    loadVersion.current++;
    setAuthorized(false);
    setPassword("");
    setOtp("");
    clearPrivateData();
    setMailFilter(null);
    setLoading(true);
    setError("");
    try {
      const result = await logoutAffiliateAdmin();
      if (!result.ok) {
        setError(
          "Não foi possível confirmar a saída. Feche esta aba; a sessão expira em até 2 horas.",
        );
      }
    } catch {
      setError(
        "Não foi possível confirmar a saída. Feche esta aba; a sessão expira em até 2 horas.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function decide(app: AffiliateApplicationRecord, decision: "aprovada" | "recusada") {
    if (workingId || app.status !== "pendente" || !authorized) return;
    const sessionId = sessionVersion.current;
    setWorkingId(app.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewAffiliateApplication({ data: { id: app.id, decision } });
      if (sessionVersion.current !== sessionId) return;
      if (!result.ok) {
        setError(result.reason);
      } else {
        setNotice(
          (decision === "aprovada" ? "Inscrição aprovada." : "Inscrição recusada.") +
            (result.emailSent
              ? " Notificação enviada."
              : " Notificação registrada para envio; confira a fila de e-mails."),
        );
      }
      await load(status, page, search);
    } catch {
      if (sessionVersion.current === sessionId)
        setError(
          "Não foi possível concluir a decisão. Confira o status antes de tentar novamente.",
        );
    } finally {
      if (sessionVersion.current === sessionId) setWorkingId(null);
    }
  }

  async function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(status, 0, searchText.trim());
  }

  return (
    <div className="min-h-screen bg-[#f9f6f3] text-[#332428]">
      <header className="border-b border-[#e8dbd8] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5">
          <Link to="/" aria-label="Voltar para Vonix Hair">
            <img src={LOGO} alt="Vonix Hair" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-bold uppercase tracking-widest text-[#9b777d] sm:block">
              Gestão de afiliadas
            </span>
            {authorized && (
              <button
                onClick={() => void signOut()}
                disabled={loading && !authorized}
                className="rounded-full border border-[#dcc7c9] px-5 py-2 text-sm font-semibold hover:bg-[#faf2f2]"
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
        <div className="mb-9">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#f0e2e1] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#7e404a]">
            <ShieldCheck className="h-4 w-4" /> Acesso restrito
          </div>
          <h1 className="font-display text-4xl sm:text-5xl">Seleção de afiliadas</h1>
          <p className="mt-3 text-sm text-[#806a6c]">
            Analise inscrições, visite os perfis e acompanhe as decisões da equipe Vonix Hair.
          </p>
        </div>

        {checkingSession ? (
          <div
            role="status"
            className="rounded-2xl border border-[#eadbd7] bg-white px-6 py-12 text-sm text-[#806a6c]"
          >
            Verificando acesso da equipe...
          </div>
        ) : !authorized ? (
          <form
            onSubmit={(e) => void login(e)}
            className="max-w-lg rounded-[2rem] border border-[#e8dcd8] bg-white p-7 shadow-sm sm:p-10"
          >
            <LockKeyhole className="mb-5 h-9 w-9 text-[#864a56]" />
            <h2 className="font-display text-3xl">Acesso da equipe</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#806c6e]">
              Informe a senha administrativa para consultar e analisar as inscrições.
            </p>
            <label className="mt-7 block text-sm font-semibold" htmlFor="admin-password">
              Senha administrativa
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d1ce] px-4 outline-none focus:ring-2 focus:ring-[#e8c9c5]"
            />
            <label className="mt-5 block text-sm font-semibold" htmlFor="admin-otp">
              Código do autenticador
            </label>
            <input
              id="admin-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="6 dígitos (se habilitado)"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#e3d1ce] px-4 tracking-[.3em] outline-none focus:ring-2 focus:ring-[#e8c9c5]"
            />
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#693440] px-6 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verificando acesso..." : "Acessar inscrições"}{" "}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {STATUS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setNotice("");
                    void load(item.key, 0, search, null);
                  }}
                  disabled={loading}
                  aria-pressed={status === item.key}
                  className={
                    "flex items-center justify-between rounded-2xl border p-5 text-left transition " +
                    (status === item.key
                      ? "border-[#8c4d59] bg-[#fff7f5] shadow-md"
                      : "border-[#e8dcd8] bg-white hover:border-[#c59ca2]")
                  }
                >
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#8b7375]">
                      {item.label}
                    </div>
                    <div className="mt-2 font-display text-4xl">
                      {item.key === "todas" ? stats.aprovada + stats.recusada : stats[item.key]}
                    </div>
                  </div>
                  {item.key === "pendente" ? (
                    <Clock3 className="h-6 w-6 text-amber-700" />
                  ) : item.key === "aprovada" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  ) : item.key === "todas" ? (
                    <Mail className="h-6 w-6 text-[#8f5361]" />
                  ) : (
                    <XCircle className="h-6 w-6 text-slate-500" />
                  )}
                </button>
              ))}
            </div>

            <section
              aria-labelledby="affiliate-mail-summary"
              className="mt-6 rounded-[1.5rem] border border-[#e8dcd8] bg-white p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-[#8f5361]" aria-hidden="true" />
                <div>
                  <h2 id="affiliate-mail-summary" className="font-display text-xl">
                    Notificações das candidatas
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#856f73]">
                    Os e-mails aceitos pelo provedor não são necessariamente entregues. Em caso de
                    envio incerto, confira o provedor antes de tentar novamente. Clique em um status
                    abaixo para localizar notificações que precisam de atenção.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {MAIL_STATUS.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    disabled={loading}
                    aria-pressed={status === "todas" && mailFilter === item.key}
                    aria-label={`Ver notificações: ${item.label.toLowerCase()}`}
                    onClick={() => {
                      setNotice("");
                      void load(
                        "todas",
                        0,
                        search,
                        status === "todas" && mailFilter === item.key ? null : item.key,
                      );
                    }}
                    className={
                      "rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 " +
                      (status === "todas" && mailFilter === item.key
                        ? "border-[#8c4d59] bg-[#fff0ec] shadow-sm"
                        : "border-[#f0e6e2] bg-[#fcf9f7] hover:border-[#c9a6aa] hover:bg-[#fffaf8]")
                    }
                  >
                    <p className="text-xs font-medium text-[#786467]">{item.label}</p>
                    <p className={"mt-1 font-display text-3xl " + item.color}>
                      {mailStats[item.key]}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl">
                  {STATUS.find((item) => item.key === status)?.label}
                  {status === "todas" &&
                    mailFilter &&
                    " — " + MAIL_STATUS.find((item) => item.key === mailFilter)?.label}
                </h2>
                <p className="mt-1 text-xs text-[#8c7778]">
                  {total} inscrição(ões) nesta consulta · {PER_PAGE} por página
                </p>
              </div>
              <form
                onSubmit={(event) => void applySearch(event)}
                className="flex w-full max-w-sm gap-2"
              >
                <input
                  aria-label="Buscar por nome ou e-mail"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Nome ou e-mail"
                  maxLength={70}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#e8d7d4] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#e8c9c5]"
                />
                <button
                  aria-label="Buscar"
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#693440] text-white"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>
            </div>

            {notice && (
              <div
                role="status"
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
              >
                {notice}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </div>
            )}
            {loading && (
              <p role="status" className="mt-8 text-sm text-[#806a6c]">
                Carregando inscrições...
              </p>
            )}
            {!loading && applications.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-[#d9c4c4] bg-white px-6 py-16 text-center">
                <p className="font-display text-2xl">Nenhuma inscrição encontrada</p>
                <p className="mt-2 text-sm text-[#907b7c]">
                  Tente outro status ou ajuste sua busca.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5">
              {applications.map((app) => {
                const instagram = safeProfileLink(app.instagram_url, "instagram");
                const tiktok = safeProfileLink(app.tiktok_url, "tiktok");
                const mail = app.vonix_affiliate_mail_outbox?.[0];
                return (
                  <article
                    key={app.id}
                    className="overflow-hidden rounded-[1.75rem] border border-[#eadbd7] bg-white shadow-[0_6px_24px_rgba(65,25,37,.04)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#f3e7e3] px-6 py-6">
                      <div>
                        <h3 className="font-display text-2xl">{app.full_name}</h3>
                        <p className="mt-1 text-xs text-[#897375]">
                          Inscrita em {new Date(app.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <span
                        className={
                          "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide " +
                          statusStyle[app.status]
                        }
                      >
                        {app.status}
                      </span>
                    </div>
                    <div className="grid gap-6 px-6 py-6 md:grid-cols-[1fr_1.1fr]">
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-5 text-sm">
                        <div>
                          <dt className="text-xs text-[#927b7d]">Idade</dt>
                          <dd className="mt-1 font-semibold">{app.age} anos</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-[#927b7d]">Tipo de cabelo</dt>
                          <dd className="mt-1 font-semibold">{app.hair_type}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-[#927b7d]">Localização</dt>
                          <dd className="mt-1 font-semibold">
                            {app.city} / {app.state}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-[#927b7d]">E-mail</dt>
                          <dd className="mt-1 break-all font-semibold">{app.email}</dd>
                        </div>
                        <div className="col-span-2 flex flex-wrap gap-2">
                          {instagram && (
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={instagram}
                              className="inline-flex items-center gap-2 rounded-full border border-[#d6b9be] px-4 py-2 text-xs font-semibold text-[#6d3c45] hover:bg-[#fff4f3]"
                            >
                              Instagram <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {tiktok && (
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={tiktok}
                              className="inline-flex items-center gap-2 rounded-full border border-[#d6b9be] px-4 py-2 text-xs font-semibold text-[#6d3c45] hover:bg-[#fff4f3]"
                            >
                              TikTok <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </dl>
                      <div className="rounded-2xl bg-[#fcf7f4] p-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#9a686b]">
                          Por que deseja participar?
                        </h4>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#5a4246]">
                          {app.motivation || "Não informado no questionário de cinco etapas."}
                        </p>
                      </div>
                    </div>
                    {app.questionnaireSummary && (
                      <section
                        aria-label="Respostas do questionário"
                        className="border-t border-[#f3e7e3] bg-[#fffdfb] px-6 py-6"
                      >
                        <h4 className="font-display text-2xl text-[#5b343b]">
                          Perfil da candidatura
                        </h4>
                        <p className="mt-1 text-xs text-[#92797e]">
                          Resumo para triagem. Documentos pessoais e endereço completo permanecem
                          criptografados e não são exibidos aqui.
                        </p>
                        <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          {(
                            [
                              [
                                "Nicho de conteúdo",
                                app.questionnaireSummary.otherNiche ||
                                  app.questionnaireSummary.niche,
                              ],
                              [
                                "Seguidores no Instagram",
                                app.questionnaireSummary.instagramFollowers || "Não informado",
                              ],
                              ["Seguidores no TikTok", app.questionnaireSummary.tiktokFollowers],
                              [
                                "Inscrição municipal",
                                app.questionnaireSummary.municipalRegistration === "sim"
                                  ? "Sim"
                                  : "Não",
                              ],
                              ["Dependentes", app.questionnaireSummary.dependents],
                              ["Linha preferida", app.questionnaireSummary.preferredLine],
                              [
                                "Nome sugerido para cupom",
                                app.questionnaireSummary.couponSuggestion,
                              ],
                            ] as const
                          ).map(([label, answer]) => (
                            <div key={label}>
                              <dt className="text-xs font-semibold text-[#96777c]">{label}</dt>
                              <dd className="mt-1 break-words font-semibold text-[#5b4148]">
                                {answer}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}
                    {app.status === "pendente" ? (
                      <div className="flex flex-wrap gap-3 border-t border-[#f3e7e3] bg-[#fffaf7] px-6 py-5">
                        <button
                          type="button"
                          disabled={workingId !== null || loading}
                          onClick={() => void decide(app, "aprovada")}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#315f50] px-6 text-sm font-bold text-white hover:bg-[#204d3e] disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />{" "}
                          {workingId === app.id ? "Processando..." : "APROVAR"}
                        </button>
                        <button
                          type="button"
                          disabled={workingId !== null || loading}
                          onClick={() => void decide(app, "recusada")}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ba8589] px-6 text-sm font-bold text-[#773c45] hover:bg-[#fff1f1] disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> RECUSAR
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f3e7e3] bg-[#fffaf7] px-6 py-4 text-sm">
                        <span className="font-semibold text-[#6a5559]">
                          {app.reviewed_at
                            ? "Analisada em " + new Date(app.reviewed_at).toLocaleString("pt-BR")
                            : "Inscrição analisada"}
                        </span>
                        <span
                          className={
                            "rounded-lg px-3 py-2 text-xs font-semibold " +
                            (mail?.status === "enviado"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-900")
                          }
                        >
                          {mail ? mailLabels[mail.status] : "Sem registro de e-mail"}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {total > PER_PAGE && (
              <div className="mt-7 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={loading || page === 0}
                  onClick={() => void load(status, page - 1, search)}
                  className="rounded-full border border-[#dfc9c7] bg-white px-5 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-sm text-[#7b6267]">
                  Página {page + 1} de {Math.ceil(total / PER_PAGE)}
                </span>
                <button
                  type="button"
                  disabled={loading || (page + 1) * PER_PAGE >= total}
                  onClick={() => void load(status, page + 1, search)}
                  className="rounded-full border border-[#dfc9c7] bg-white px-5 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
