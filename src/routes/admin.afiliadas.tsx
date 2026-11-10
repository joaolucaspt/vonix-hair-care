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
  eraseAffiliateApplicationAdmin,
  getAffiliateApplications,
  getAffiliateApplicationPrivateDetail,
  getAffiliateOperationalReadiness,
  getAffiliateRetentionPreview,
  loginAffiliateAdmin,
  logoutAffiliateAdmin,
  reviewAffiliateApplication,
} from "@/lib/affiliate-functions";
import type { AffiliatePrivateDetail } from "@/lib/affiliate-wizard-crypto.server";
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
  enviado: "E-mail aceito pelo provedor (entrega não confirmada)",
  falhou: "Falha no envio — verificar",
  incerto: "Envio incerto — conciliar antes de reenviar",
};

const PRIVATE_ANSWER_FIELDS: ReadonlyArray<{
  key: keyof AffiliatePrivateDetail["answers"];
  label: string;
}> = [
  { key: "firstName", label: "Nome" },
  { key: "lastName", label: "Sobrenome" },
  { key: "phone", label: "Celular" },
  { key: "email", label: "E-mail informado" },
  { key: "cpf", label: "CPF" },
  { key: "cnpj", label: "CNPJ (opcional)" },
  { key: "birthDate", label: "Data de nascimento" },
  { key: "birthCity", label: "Cidade de nascimento" },
  { key: "postalCode", label: "CEP" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "street", label: "Logradouro" },
  { key: "district", label: "Bairro" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "instagramUsername", label: "Usuário Instagram" },
  { key: "tiktokUsername", label: "Usuário TikTok" },
  { key: "xUsername", label: "Usuário X" },
  { key: "youtubeUsername", label: "Canal YouTube" },
  { key: "niche", label: "Nicho" },
  { key: "otherNiche", label: "Outro nicho" },
  { key: "instagramFollowers", label: "Seguidores Instagram" },
  { key: "tiktokFollowers", label: "Seguidores TikTok" },
  { key: "municipalRegistration", label: "Possui inscrição municipal" },
  { key: "municipalNumber", label: "Número inscrição municipal" },
  { key: "dependents", label: "Dependentes" },
  { key: "preferredLine", label: "Linha Vonix preferida" },
  { key: "couponSuggestion", label: "Nome sugerido para cupom" },
  { key: "hairType", label: "Tipo de cabelo" },
];

function safeProfileLink(value: string | null | undefined, platform: "instagram" | "tiktok") {
  try {
    if (!value) return null;
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      url.protocol !== "https:" ||
      host !== (platform === "instagram" ? "instagram.com" : "tiktok.com") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port
    )
      return null;
    const validPath =
      platform === "instagram"
        ? /^\/[A-Za-z0-9._]{1,30}\/?$/.test(url.pathname)
        : /^\/@[A-Za-z0-9._]{2,30}\/?$/.test(url.pathname);
    if (!validPath) return null;
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
  const [sessionRechecking, setSessionRechecking] = useState(false);
  const [sessionRecheckFailed, setSessionRecheckFailed] = useState(false);
  const [sessionRecheckRetry, setSessionRecheckRetry] = useState(0);
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
  const [privateDetail, setPrivateDetail] = useState<
    (AffiliatePrivateDetail & { id: string }) | null
  >(null);
  const [privateDetailLoading, setPrivateDetailLoading] = useState<string | null>(null);
  const [privateDetailError, setPrivateDetailError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    id: string;
    decision: "aprovada" | "recusada";
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [erasureId, setErasureId] = useState<string | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [readiness, setReadiness] = useState<{
    checks: Array<{ id: string; label: string; ok: boolean }>;
    databaseResponding: boolean;
    governanceResponding: boolean;
    recruitmentOpen: boolean;
  } | null>(null);
  const [retentionPendingDays, setRetentionPendingDays] = useState(90);
  const [retentionRejectedDays, setRetentionRejectedDays] = useState(180);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [retentionError, setRetentionError] = useState("");
  const [retentionResult, setRetentionResult] = useState<{
    pendingEligible: number;
    rejectedEligible: number;
    executedDeletions: number;
    pendingDays: number;
    rejectedDays: number;
  } | null>(null);
  const [erasureEmail, setErasureEmail] = useState("");
  const [erasureReason, setErasureReason] = useState<
    "solicitacao_titular" | "retencao" | "correcao"
  >("solicitacao_titular");

  // Versions prevent any in-flight list or decision from restoring private data after logout.
  const sessionVersion = useRef(0);
  const loadVersion = useRef(0);
  // A preview becomes obsolete as soon as the operator changes either interval.
  const retentionVersion = useRef(0);
  // Invalidate pending confidential reads on logout, tab hide or filter changes.
  const privateDetailVersion = useRef(0);

  function clearPrivateData() {
    setSessionRechecking(false);
    setSessionRecheckFailed(false);
    setSessionRecheckRetry(0);
    privateDetailVersion.current++;
    setPrivateDetail(null);
    setPrivateDetailLoading(null);
    setPrivateDetailError(null);
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
    setPendingDecision(null);
    setNotice("");
    setErasureId(null);
    setErasureEmail("");
    setReadiness(null);
    setReadinessBusy(false);
    retentionVersion.current += 1;
    setRetentionBusy(false);
    setRetentionError("");
    setRetentionResult(null);
  }

  function sessionExpired(reason: string): boolean {
    if (reason !== "Acesso negado. Faça login novamente.") return false;
    sessionVersion.current += 1;
    loadVersion.current += 1;
    setAuthorized(false);
    setPassword("");
    setOtp("");
    clearPrivateData();
    setLoading(false);
    setError("Sua sessão expirou. Faça login novamente.");
    return true;
  }

  function invalidateRetentionPreview() {
    retentionVersion.current += 1;
    setRetentionResult(null);
    setRetentionError("");
    setRetentionBusy(false);
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
    // Clear old applicant cards and confidential detail when filters change.
    privateDetailVersion.current++;
    setPrivateDetail(null);
    setPrivateDetailLoading(null);
    setPrivateDetailError(null);
    setApplications([]);
    setTotal(0);
    setLoading(true);
    setPendingDecision(null);
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
        if (!sessionExpired(response.reason)) setError(response.reason);
        return;
      }
      // Deletions or decisions can empty the last page while another page
      // still contains records. Refresh the last *valid* page instead of
      // stranding the reviewer on an empty page with no pagination controls.
      const lastPage = Math.max(0, Math.ceil(response.total / PER_PAGE) - 1);
      if (nextPage > lastPage) {
        await load(nextStatus, lastPage, nextSearch, nextMailFilter);
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

  // A tab left open can outlive the signed two-hour admin session. Recheck
  // authorization when it becomes active rather than leaving applicant data
  // visible until the operator attempts a new action.
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    let inFlight = false;

    async function verifyResumedSession() {
      if (!active || inFlight) return;
      inFlight = true;
      const sessionId = sessionVersion.current;
      // Never render applicant PII before an active tab has revalidated the
      // signed cookie. A transient network failure must leave data concealed.
      setSessionRechecking(true);
      setSessionRecheckFailed(false);
      try {
        const session = await getAffiliateAdminSession();
        if (!active || sessionId !== sessionVersion.current) return;
        if (!session.authenticated) {
          sessionExpired("Acesso negado. Faça login novamente.");
        } else if (document.visibilityState === "visible") {
          setSessionRechecking(false);
        }
      } catch {
        // An uncertain session stays masked; the operator can retry without
        // discarding the page's state or exposing applicants.
        if (active && sessionId === sessionVersion.current) setSessionRecheckFailed(true);
      } finally {
        inFlight = false;
      }
    }

    const onFocus = () => {
      if (document.visibilityState === "visible") void verifyResumedSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        privateDetailVersion.current++;
        setPrivateDetail(null);
        setPrivateDetailLoading(null);
        setPrivateDetailError(null);
        setSessionRechecking(true);
        setSessionRecheckFailed(false);
      } else if (document.visibilityState === "visible") {
        void verifyResumedSession();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    if (sessionRecheckRetry > 0) void verifyResumedSession();
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Session transitions, not ordinary list rendering, control the listener lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, sessionRecheckRetry]);

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
    if (
      workingId ||
      app.status !== "pendente" ||
      !authorized ||
      pendingDecision?.id !== app.id ||
      pendingDecision.decision !== decision
    )
      return;
    const sessionId = sessionVersion.current;
    setPendingDecision(null);
    setWorkingId(app.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewAffiliateApplication({ data: { id: app.id, decision } });
      if (sessionVersion.current !== sessionId) return;
      if (!result.ok) {
        if (sessionExpired(result.reason)) return;
        setError(result.reason);
      } else {
        const mailNotice =
          result.notification === "accepted"
            ? " Notificação aceita pelo provedor; entrega não confirmada."
            : result.notification === "unconfigured"
              ? " Provedor de e-mails não configurado. A notificação aguarda configuração."
              : result.notification === "review"
                ? " Envio não confirmado. Confira a fila antes de tentar novamente."
                : " Notificação registrada na fila, ainda sem confirmação de envio.";
        setNotice(
          (decision === "aprovada" ? "Inscrição aprovada." : "Inscrição recusada.") + mailNotice,
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

  async function eraseCandidate(app: AffiliateApplicationRecord) {
    if (!authorized || workingId || erasureEmail.trim().toLowerCase() !== app.email) return;
    const sessionId = sessionVersion.current;
    setWorkingId(app.id);
    setError("");
    setNotice("");
    try {
      const result = await eraseAffiliateApplicationAdmin({
        data: {
          id: app.id,
          emailConfirmation: erasureEmail.trim().toLowerCase(),
          reason: erasureReason,
        },
      });
      if (sessionId !== sessionVersion.current) return;
      if (!result.ok) {
        if (sessionExpired(result.reason)) return;
        setError(result.reason);
      } else {
        setErasureId(null);
        setErasureEmail("");
        setNotice(
          "Candidatura excluída. Dados, questionário criptografado e notificações pendentes foram eliminados.",
        );
        await load(status, Math.max(0, page), search);
      }
    } catch {
      if (sessionId === sessionVersion.current)
        setError("Falha na exclusão. Nenhum resultado foi confirmado.");
    } finally {
      if (sessionId === sessionVersion.current) setWorkingId(null);
    }
  }

  async function inspectPrivateAnswers(app: AffiliateApplicationRecord) {
    if (!authorized || sessionRechecking || workingId || loading) return;
    if (privateDetail?.id === app.id) {
      privateDetailVersion.current++;
      setPrivateDetail(null);
      setPrivateDetailError(null);
      return;
    }
    const requestId = ++privateDetailVersion.current;
    const sessionId = sessionVersion.current;
    const isCurrent = () =>
      requestId === privateDetailVersion.current &&
      sessionId === sessionVersion.current &&
      document.visibilityState === "visible";
    setPrivateDetail(null);
    setPrivateDetailError(null);
    setPrivateDetailLoading(app.id);
    try {
      const result = await getAffiliateApplicationPrivateDetail({ data: { id: app.id } });
      if (!isCurrent()) return;
      if (!result.ok) {
        if (sessionExpired(result.reason)) return;
        setPrivateDetailError({ id: app.id, message: result.reason });
        return;
      }
      setPrivateDetail({ id: app.id, ...result.detail });
    } catch {
      if (isCurrent())
        setPrivateDetailError({
          id: app.id,
          message: "Falha ao consultar dados protegidos. A candidatura permanece no banco.",
        });
    } finally {
      if (isCurrent()) setPrivateDetailLoading(null);
    }
  }

  async function inspectReadiness() {
    if (!authorized || loading || readinessBusy) return;
    const sessionId = sessionVersion.current;
    setReadinessBusy(true);
    setReadiness(null);
    setError("");
    try {
      const result = await getAffiliateOperationalReadiness();
      if (sessionId !== sessionVersion.current) return;
      if (!result.ok) {
        if (!sessionExpired(result.reason)) setError(result.reason);
        return;
      }
      setReadiness(result);
    } catch {
      if (sessionId === sessionVersion.current)
        setError("Não foi possível verificar a preparação do programa.");
    } finally {
      if (sessionId === sessionVersion.current) setReadinessBusy(false);
    }
  }

  async function inspectRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || retentionBusy) return;
    if (
      !Number.isInteger(retentionPendingDays) ||
      retentionPendingDays < 30 ||
      retentionPendingDays > 3650 ||
      !Number.isInteger(retentionRejectedDays) ||
      retentionRejectedDays < 30 ||
      retentionRejectedDays > 3650
    ) {
      setRetentionError("Informe prazos inteiros entre 30 e 3.650 dias.");
      setRetentionResult(null);
      return;
    }

    const sessionId = sessionVersion.current;
    const requestId = ++retentionVersion.current;
    const isCurrent = () =>
      sessionId === sessionVersion.current && requestId === retentionVersion.current;
    setRetentionBusy(true);
    setRetentionError("");
    setRetentionResult(null);
    try {
      const response = await getAffiliateRetentionPreview({
        data: { pendingDays: retentionPendingDays, rejectedDays: retentionRejectedDays },
      });
      if (!isCurrent()) return;
      if (!response.ok) {
        if (!sessionExpired(response.reason)) setRetentionError(response.reason);
        return;
      }
      setRetentionResult({
        pendingEligible: response.pendingEligible,
        rejectedEligible: response.rejectedEligible,
        executedDeletions: response.executedDeletions,
        pendingDays: retentionPendingDays,
        rejectedDays: retentionRejectedDays,
      });
    } catch {
      if (isCurrent()) setRetentionError("Não foi possível consultar a prévia de retenção.");
    } finally {
      if (isCurrent()) setRetentionBusy(false);
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
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="6 dígitos obrigatórios"
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
              disabled={loading || !password || otp.length !== 6}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#693440] px-6 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verificando acesso..." : "Acessar inscrições"}{" "}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        ) : sessionRechecking ? (
          <section
            role="status"
            aria-live="polite"
            className="max-w-xl rounded-[2rem] border border-[#e8dcd8] bg-white px-7 py-10 shadow-sm"
          >
            <LockKeyhole aria-hidden="true" className="mb-4 h-8 w-8 text-[#864a56]" />
            <h2 className="font-display text-2xl">Protegendo dados das candidatas</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#806c6e]">
              {sessionRecheckFailed
                ? "Não foi possível confirmar sua sessão. Os dados continuam ocultos até uma nova verificação."
                : "Confirmando a validade do acesso antes de mostrar dados pessoais."}
            </p>
            {sessionRecheckFailed && (
              <button
                type="button"
                className="mt-5 min-h-11 rounded-full bg-[#693440] px-6 text-sm font-semibold text-white"
                onClick={() => setSessionRecheckRetry((previous) => previous + 1)}
              >
                Tentar verificar novamente
              </button>
            )}
          </section>
        ) : (
          <>
            <section
              aria-label="Preparação do programa"
              className="mb-6 rounded-[1.5rem] border border-[#e8dcd8] bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">Preparação para abertura</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#806a6c]">
                    Diagnóstico privado de configuração. A presença de uma chave não confirma que o
                    envio de e-mails, a migração ou os requisitos jurídicos estejam homologados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void inspectReadiness()}
                  disabled={readinessBusy || loading}
                  className="min-h-11 rounded-full border border-[#d6b6be] px-5 text-sm font-semibold text-[#733e4a] disabled:opacity-50"
                >
                  {readinessBusy ? "Verificando preparação..." : "Verificar preparação"}
                </button>
              </div>
              {readiness && (
                <div className="mt-5">
                  <p role="status" className="text-sm font-semibold text-[#6c4b53]">
                    {readiness.recruitmentOpen
                      ? "A configuração autoriza abertura; confira a homologação operacional."
                      : "As inscrições permanecem bloqueadas."}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {readiness.checks.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#f1e4e2] p-3 text-sm"
                      >
                        <span>{item.label}</span>
                        <span
                          className={
                            item.ok
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-amber-700"
                          }
                        >
                          {item.ok ? "Configurado" : "Pendente"}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#f1e4e2] p-3 text-sm">
                      <span>Consulta de banco</span>
                      <span
                        className={
                          readiness.databaseResponding
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-amber-700"
                        }
                      >
                        {readiness.databaseResponding ? "Respondeu" : "Não confirmada"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#f1e4e2] p-3 text-sm">
                      <span>RPC de governança</span>
                      <span
                        className={
                          readiness.governanceResponding
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-amber-700"
                        }
                      >
                        {readiness.governanceResponding ? "Respondeu" : "Não confirmada"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>
            <section
              aria-labelledby="affiliate-retention-title"
              className="mb-6 rounded-[1.5rem] border border-[#e8dcd8] bg-white p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#8f5361]" aria-hidden="true" />
                <div>
                  <h2 id="affiliate-retention-title" className="font-display text-2xl">
                    Prévia de retenção LGPD
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#806a6c]">
                    Consulte apenas quantidades de inscrições antigas para revisão pela equipe. Esta
                    consulta não mostra CPF, endereço ou e-mail e não executa exclusões. Os prazos
                    são exemplos de planejamento, não uma política aprovada.
                  </p>
                </div>
              </div>
              <form
                onSubmit={(event) => void inspectRetention(event)}
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <label htmlFor="retention-pending" className="text-sm font-semibold text-[#654c52]">
                  Pendentes há pelo menos (dias)
                  <input
                    id="retention-pending"
                    type="number"
                    min={30}
                    max={3650}
                    step={1}
                    required
                    value={retentionPendingDays}
                    onChange={(event) => {
                      setRetentionPendingDays(Number(event.target.value));
                      invalidateRetentionPreview();
                    }}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[#dbc3c7] bg-white px-4 text-base"
                  />
                </label>
                <label
                  htmlFor="retention-rejected"
                  className="text-sm font-semibold text-[#654c52]"
                >
                  Recusadas há pelo menos (dias)
                  <input
                    id="retention-rejected"
                    type="number"
                    min={30}
                    max={3650}
                    step={1}
                    required
                    value={retentionRejectedDays}
                    onChange={(event) => {
                      setRetentionRejectedDays(Number(event.target.value));
                      invalidateRetentionPreview();
                    }}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[#dbc3c7] bg-white px-4 text-base"
                  />
                </label>
                <button
                  type="submit"
                  disabled={retentionBusy}
                  className="min-h-11 rounded-full border border-[#d6b6be] px-5 text-sm font-semibold text-[#733e4a] disabled:opacity-50"
                >
                  {retentionBusy ? "Consultando..." : "Consultar prévia"}
                </button>
              </form>
              {retentionError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {retentionError}
                </p>
              )}
              {retentionResult && (
                <div role="status" className="mt-5 grid gap-3 sm:grid-cols-2">
                  <p className="text-xs font-medium text-[#74545d] sm:col-span-2">
                    Critérios desta consulta: pendentes há pelo menos {retentionResult.pendingDays}{" "}
                    dias; recusadas há pelo menos {retentionResult.rejectedDays} dias.
                  </p>
                  <div className="rounded-xl border border-[#f0e3df] bg-[#fffaf8] p-4">
                    <p className="text-xs text-[#806a6c]">Candidaturas pendentes para revisão</p>
                    <p className="mt-2 font-display text-3xl text-[#633e49]">
                      {retentionResult.pendingEligible}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#f0e3df] bg-[#fffaf8] p-4">
                    <p className="text-xs text-[#806a6c]">Candidaturas recusadas para revisão</p>
                    <p className="mt-2 font-display text-3xl text-[#633e49]">
                      {retentionResult.rejectedEligible}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-[#806a6c] sm:col-span-2">
                    Exclusões executadas por esta consulta: {retentionResult.executedDeletions}.
                    Nenhuma candidatura aprovada é incluída nesta prévia. Qualquer exclusão exige
                    análise jurídica, confirmação do titular e ação individual autorizada.
                  </p>
                </div>
              )}
            </section>

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
                    <section
                      aria-label={"Consulta protegida de " + app.full_name}
                      className="border-t border-[#f3e7e3] bg-[#fcf8f5] px-6 py-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-[#623b45]">
                            Questionário completo
                          </h4>
                          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#806a6c]">
                            CPF, contato e endereço são carregados apenas sob demanda, com sessão
                            administrativa autenticada. Não compartilhe estes dados.
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-expanded={privateDetail?.id === app.id}
                          disabled={privateDetailLoading !== null || loading || workingId !== null}
                          onClick={() => void inspectPrivateAnswers(app)}
                          className="min-h-11 rounded-full border border-[#cfaeb4] bg-white px-5 text-sm font-semibold text-[#693440] hover:bg-[#f8ebed] disabled:opacity-50"
                        >
                          {privateDetailLoading === app.id
                            ? "Carregando respostas..."
                            : privateDetail?.id === app.id
                              ? "Ocultar respostas"
                              : "Ver todas as respostas"}
                        </button>
                      </div>
                      {privateDetailError?.id === app.id && (
                        <p role="alert" className="mt-4 text-sm text-red-700">
                          {privateDetailError.message}
                        </p>
                      )}
                      {privateDetail?.id === app.id && (
                        <div
                          className="mt-5 rounded-2xl border border-[#dfc7ca] bg-white p-5"
                          aria-label={"Respostas confidenciais de " + app.full_name}
                        >
                          <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#905e69]">
                            Informações confidenciais · Inscrição enviada em{" "}
                            {new Date(privateDetail.acceptedAt).toLocaleString("pt-BR")}
                          </p>
                          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            {PRIVATE_ANSWER_FIELDS.map(({ key, label }) => (
                              <div key={key} className="min-w-0 border-b border-[#f2e6e5] pb-3">
                                <dt className="text-xs font-semibold text-[#98757b]">{label}</dt>
                                <dd className="mt-1 whitespace-pre-wrap break-words font-medium text-[#392930]">
                                  {privateDetail.answers[key] || "Não informado"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </section>
                    {app.status === "pendente" ? (
                      <div className="flex flex-wrap gap-3 border-t border-[#f3e7e3] bg-[#fffaf7] px-6 py-5">
                        <button
                          type="button"
                          disabled={workingId !== null || loading}
                          onClick={() => setPendingDecision({ id: app.id, decision: "aprovada" })}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#315f50] px-6 text-sm font-bold text-white hover:bg-[#204d3e] disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />{" "}
                          {workingId === app.id ? "Processando..." : "APROVAR"}
                        </button>
                        <button
                          type="button"
                          disabled={workingId !== null || loading}
                          onClick={() => setPendingDecision({ id: app.id, decision: "recusada" })}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ba8589] px-6 text-sm font-bold text-[#773c45] hover:bg-[#fff1f1] disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> RECUSAR
                        </button>
                        {pendingDecision?.id === app.id && (
                          <div
                            role="group"
                            aria-label="Confirmar decisão da candidatura"
                            className="w-full rounded-xl border border-[#d6b6be] bg-white p-5"
                          >
                            <p className="text-sm font-semibold text-[#5b343b]">
                              {pendingDecision.decision === "aprovada"
                                ? "Confirmar aprovação"
                                : "Confirmar recusa"}{" "}
                              de {app.full_name}?
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-[#806a6c]">
                              Esta decisão é definitiva no painel e poderá gerar uma notificação por
                              e-mail. Confira a candidatura antes de confirmar.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={workingId !== null || loading}
                                onClick={() => void decide(app, pendingDecision.decision)}
                                className="min-h-11 rounded-full bg-[#673541] px-5 text-sm font-bold text-white disabled:opacity-50"
                              >
                                {pendingDecision.decision === "aprovada"
                                  ? "Confirmar aprovação"
                                  : "Confirmar recusa"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDecision(null)}
                                className="min-h-11 rounded-full border border-[#dcc8c6] px-5 text-sm font-semibold text-[#68464e]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
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
                    <div className="border-t border-[#f3e7e3] px-6 py-4">
                      <button
                        type="button"
                        disabled={workingId !== null || loading}
                        onClick={() => {
                          setErasureId(erasureId === app.id ? null : app.id);
                          setErasureEmail("");
                          setErasureReason("solicitacao_titular");
                        }}
                        aria-expanded={erasureId === app.id}
                        className="text-xs font-semibold text-[#8e5761] underline disabled:opacity-50"
                      >
                        {erasureId === app.id
                          ? "Cancelar solicitação de exclusão"
                          : "Exclusão de dados (LGPD)"}
                      </button>
                      {erasureId === app.id && (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void eraseCandidate(app);
                          }}
                          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5"
                        >
                          <h4 className="font-semibold text-red-900">
                            Exclusão irreversível da candidatura
                          </h4>
                          <p className="mt-2 text-xs leading-relaxed text-red-800">
                            Só execute após verificar a identidade da solicitante ou aprovar
                            formalmente a política de retenção. O banco apagará o questionário,
                            contatos e mensagens ainda não enviadas. E-mails já entregues a
                            provedores externos não podem ser apagados por este botão. Envios em
                            processamento bloqueiam a exclusão.
                          </p>
                          <label
                            htmlFor={"erase-reason-" + app.id}
                            className="mt-4 block text-xs font-semibold"
                          >
                            Motivo documentado
                          </label>
                          <select
                            id={"erase-reason-" + app.id}
                            value={erasureReason}
                            onChange={(event) =>
                              setErasureReason(event.target.value as typeof erasureReason)
                            }
                            className="mt-2 min-h-11 w-full rounded-lg border border-red-200 bg-white px-3 text-sm"
                          >
                            <option value="solicitacao_titular">
                              Solicitação da titular verificada
                            </option>
                            <option value="retencao">
                              Retenção expirada após aprovação da política
                            </option>
                            <option value="correcao">Correção de cadastro</option>
                          </select>
                          <label
                            htmlFor={"erase-email-" + app.id}
                            className="mt-4 block text-xs font-semibold"
                          >
                            Confirme digitando o e-mail da candidata: {app.email}
                          </label>
                          <input
                            id={"erase-email-" + app.id}
                            type="email"
                            autoComplete="off"
                            value={erasureEmail}
                            onChange={(event) => setErasureEmail(event.target.value)}
                            className="mt-2 min-h-11 w-full rounded-lg border border-red-200 bg-white px-3 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={
                              workingId !== null || erasureEmail.trim().toLowerCase() !== app.email
                            }
                            className="mt-4 min-h-11 rounded-full bg-red-800 px-6 text-sm font-bold text-white disabled:opacity-40"
                          >
                            Confirmar exclusão definitiva
                          </button>
                        </form>
                      )}
                    </div>
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
