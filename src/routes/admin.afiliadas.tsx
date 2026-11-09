import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { LOGO } from "@/components/site";
import { getAffiliateApplications, reviewAffiliateApplication } from "@/lib/affiliate-functions";
import type {
  AffiliateApplicationRecord,
  AffiliateStatus,
  AffiliateMailStatus,
} from "@/lib/affiliate-application";

export const Route = createFileRoute("/admin/afiliadas")({
  head: () => ({
    meta: [
      { title: "Seleção de afiliadas | Vonix Hair" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AffiliateAdminPage,
});

const STATUS: { key: AffiliateStatus; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "recusada", label: "Recusadas" },
];
const PER_PAGE = 40;
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

function safeProfileLink(value: string, platform: "instagram" | "tiktok") {
  try {
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

function AffiliateAdminPage() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<AffiliateStatus>("pendente");
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState<AffiliateApplicationRecord[]>([]);
  const [stats, setStats] = useState<Record<AffiliateStatus, number>>({
    pendente: 0,
    aprovada: 0,
    recusada: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load(nextStatus = status, nextPage = page, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await getAffiliateApplications({
        data: { password, status: nextStatus, page: nextPage, search: nextSearch || undefined },
      });
      if (!response.ok) {
        setError(response.reason);
        if (response.reason.includes("Acesso negado")) setAuthorized(false);
        return;
      }
      setAuthorized(true);
      setStatus(nextStatus);
      setPage(nextPage);
      setSearch(nextSearch);
      setApplications(response.applications);
      setStats(response.stats);
      setTotal(response.total);
    } catch {
      setError("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setPassword("");
    setAuthorized(false);
    setApplications([]);
    setError("");
    setNotice("");
  }

  async function decide(app: AffiliateApplicationRecord, decision: "aprovada" | "recusada") {
    if (workingId || app.status !== "pendente") return;
    setWorkingId(app.id);
    setError("");
    setNotice("");
    try {
      const result = await reviewAffiliateApplication({ data: { password, id: app.id, decision } });
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
      setError("Não foi possível concluir a decisão. Confira o status antes de tentar novamente.");
    } finally {
      setWorkingId(null);
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
                onClick={signOut}
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

        {!authorized ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load("pendente", 0, "");
            }}
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
            <div className="grid gap-4 sm:grid-cols-3">
              {STATUS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setNotice("");
                    void load(item.key, 0, search);
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
                    <div className="mt-2 font-display text-4xl">{stats[item.key]}</div>
                  </div>
                  {item.key === "pendente" ? (
                    <Clock3 className="h-6 w-6 text-amber-700" />
                  ) : item.key === "aprovada" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  ) : (
                    <XCircle className="h-6 w-6 text-slate-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl">
                  {STATUS.find((item) => item.key === status)?.label}
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
                          {app.motivation}
                        </p>
                      </div>
                    </div>
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
