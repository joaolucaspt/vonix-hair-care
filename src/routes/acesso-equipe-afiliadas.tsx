import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRoundCheck } from "lucide-react";
import { AffiliateShell } from "@/components/affiliate-shell";
import { loginAffiliateAdminMember, requestAffiliateAccessEmail } from "@/lib/affiliate-functions";
import { vonixAffiliateAuth } from "@/lib/vonix-affiliate-auth";

export const Route = createFileRoute("/acesso-equipe-afiliadas")({
  head: () => ({
    meta: [
      { title: "Acesso da equipe de seleção | Vonix Hair" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AffiliateTeamAccess,
});

type Stage = "checking" | "email" | "password" | "first-password" | "denied";
type Invitation = { role: "reviewer" | "owner"; password_set_at: string | null };

export function AffiliateTeamAccess() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const inspectIdentity = useCallback(async () => {
    try {
      const identity = await vonixAffiliateAuth.auth.getUser();
      const user = identity.data.user;
      if (identity.error || !user?.email || !user.email_confirmed_at) {
        setStage("email");
        return;
      }
      const normalized = user.email.toLowerCase();
      setEmail(normalized);
      const row = await vonixAffiliateAuth
        .from("vonix_affiliate_admin_invites")
        .select("role,password_set_at")
        .eq("email", normalized)
        .maybeSingle();
      if (row.error || !row.data) {
        setStage("denied");
        return;
      }
      const invite = row.data as Invitation;
      setStage(invite.password_set_at ? "password" : "first-password");
    } catch {
      setStage("email");
    }
  }, []);

  useEffect(() => {
    void inspectIdentity();
    const {
      data: { subscription },
    } = vonixAffiliateAuth.auth.onAuthStateChange(() => {
      queueMicrotask(() => {
        void inspectIdentity();
      });
    });
    return () => subscription.unsubscribe();
  }, [inspectIdentity]);

  async function requestInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const alternate = await requestAffiliateAccessEmail({
        data: { email: email.trim().toLowerCase(), purpose: "owner" },
      });
      if (alternate.status === "requested") {
        setNotice(
          "Se seu e-mail está autorizado, solicitamos um código de acesso. Verifique entrada e spam. A entrega depende do provedor.",
        );
        return;
      }
      if (alternate.status === "rate-limited") {
        setError("Limite temporário de solicitações. Tente novamente mais tarde.");
        return;
      }
      if (alternate.status === "denied") {
        setError("Utilize a página oficial da equipe e solicite o acesso novamente.");
        return;
      }
      const result = await vonixAffiliateAuth.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + "/acesso-equipe-afiliadas",
        },
      });
      if (result.error) {
        setError("Não foi possível enviar o acesso. Confira o endereço ou tente novamente.");
      } else {
        setNotice(
          "Se este endereço foi autorizado pela Vonix Hair, confira seu e-mail para verificar o acesso.",
        );
      }
    } catch {
      setError("Falha de conexão ao solicitar acesso.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6,8}$/.test(otp)) return;
    setBusy(true);
    setError("");
    try {
      const response = await vonixAffiliateAuth.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });
      if (response.error) setError("Código inválido ou expirado.");
      else await inspectIdentity();
    } catch {
      setError("Não foi possível validar o código.");
    } finally {
      setBusy(false);
    }
  }

  async function activatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12 || password.length > 128 || password !== repeatPassword) {
      setError("Crie uma senha de pelo menos 12 caracteres e confirme-a corretamente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await vonixAffiliateAuth.auth.updateUser({ password });
      if (updated.error) throw new Error("Password update failed.");
      const marked = await vonixAffiliateAuth.rpc("vonix_affiliate_activate_admin_account");
      if (marked.error || marked.data !== true) throw new Error("Activation failed.");
      setRepeatPassword("");
      setStage("password");
      setNotice("Sua senha pessoal foi criada e o convite administrativo foi ativado.");
      // A fresh server-side password grant ensures that the OTP link alone
      // never grants administrative access, including on first activation.
      const login = await loginAffiliateAdminMember({
        data: { email: email.trim().toLowerCase(), password },
      });
      setPassword("");
      if (!login.ok) {
        setError(
          "Sua senha foi criada, mas o acesso ao painel ainda não está configurado. Tente entrar novamente.",
        );
        return;
      }
      window.location.assign("/admin/afiliadas");
    } catch {
      setError("Não foi possível concluir a ativação. Confira sua sessão ou solicite novo acesso.");
    } finally {
      setBusy(false);
    }
  }

  async function loginPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const exchanged = await loginAffiliateAdminMember({
        data: { email: email.trim().toLowerCase(), password },
      });
      setPassword("");
      if (!exchanged.ok) {
        setError(exchanged.reason);
        return;
      }
      window.location.assign("/admin/afiliadas");
    } catch {
      setError("Login não autorizado. Confira seu e-mail e sua senha pessoal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AffiliateShell mode="account">
      <div className="relative min-h-[75vh] bg-[#f8f1ed] px-5 py-16 text-[#392832] sm:py-24">
        <div className="mx-auto max-w-xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e7cece] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#7b4a59]">
              <ShieldCheck className="h-4 w-4" /> Equipe autorizada
            </div>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl">Gestão Vonix Hair</h1>
            <p className="mt-4 text-sm leading-relaxed text-[#806970]">
              Acesso restrito à seleção de candidaturas. Cada membro tem sua própria conta, e a
              senha pessoal é obrigatória antes de entrar no painel.
            </p>
          </div>
          <section className="rounded-[2rem] border border-[#eadad6] bg-white p-6 shadow-[0_16px_65px_rgba(72,35,43,.08)] sm:p-10">
            {stage === "checking" && (
              <p role="status">Verificando sua identidade e suas permissões...</p>
            )}
            {stage === "denied" && (
              <div role="alert">
                <LockKeyhole className="h-8 w-8 text-[#864952]" />
                <h2 className="mt-4 font-display text-2xl">Acesso não autorizado</h2>
                <p className="mt-3 text-sm">
                  Esta conta não possui convite administrativo ativo da Vonix Hair.
                </p>
                <button
                  type="button"
                  className="mt-6 text-sm font-semibold underline"
                  onClick={async () => {
                    await vonixAffiliateAuth.auth.signOut();
                    setStage("email");
                    setEmail("");
                  }}
                >
                  Sair e tentar outra conta
                </button>
              </div>
            )}
            {stage === "email" && (
              <>
                <Mail className="h-8 w-8 text-[#865766]" />
                <h2 className="mt-4 font-display text-2xl">Confirmar e-mail da equipe</h2>
                <p className="mt-2 text-sm text-[#806970]">
                  Use exclusivamente um e-mail convidado pela administração Vonix Hair.
                </p>
                <form onSubmit={requestInvitation} className="mt-6 space-y-3">
                  <label htmlFor="team-email" className="block text-sm font-semibold">
                    E-mail autorizado
                  </label>
                  <input
                    id="team-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={180}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#decace] px-4"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-12 w-full rounded-full bg-[#633847] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Verificando..." : "Enviar acesso por e-mail"}
                  </button>
                </form>
                {notice && (
                  <p role="status" className="mt-5 rounded-lg bg-[#faf1eb] p-3 text-sm">
                    {notice}
                  </p>
                )}
                <form onSubmit={verifyCode} className="mt-6 border-t border-[#f1e5e2] pt-5">
                  <label htmlFor="team-otp" className="block text-sm font-semibold">
                    Código recebido, se disponível
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="team-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      pattern="[0-9]{6,8}"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#decace] px-4"
                    />
                    <button
                      type="submit"
                      disabled={busy || !/^\d{6,8}$/.test(otp)}
                      className="min-h-11 rounded-xl border border-[#c6a8ad] px-5 text-sm font-bold text-[#6a3c4b] disabled:opacity-50"
                    >
                      Validar
                    </button>
                  </div>
                </form>
              </>
            )}
            {stage === "first-password" && (
              <>
                <KeyRound className="h-8 w-8 text-[#865766]" />
                <h2 className="mt-4 font-display text-2xl">Crie sua senha pessoal</h2>
                <p className="mt-2 text-sm text-[#806970]">
                  Seu e-mail foi verificado. Para ativar o convite, defina uma senha forte de pelo
                  menos 12 caracteres. Não compartilhe esta senha.
                </p>
                <form onSubmit={activatePassword} className="mt-6 space-y-4">
                  <label className="block text-sm font-semibold" htmlFor="team-first-password">
                    Nova senha
                  </label>
                  <input
                    id="team-first-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#decace] px-4"
                  />
                  <label className="block text-sm font-semibold" htmlFor="team-password-confirm">
                    Confirme a senha
                  </label>
                  <input
                    id="team-password-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={12}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#decace] px-4"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-12 w-full rounded-full bg-[#633847] font-semibold text-white disabled:opacity-60"
                  >
                    Ativar acesso seguro
                  </button>
                </form>
              </>
            )}
            {stage === "password" && (
              <>
                <UserRoundCheck className="h-8 w-8 text-[#865766]" />
                <h2 className="mt-4 font-display text-2xl">Entrar na gestão</h2>
                <p className="mt-2 break-all text-sm text-[#806970]">{email}</p>
                <form onSubmit={loginPassword} className="mt-6 space-y-4">
                  <label htmlFor="team-password" className="block text-sm font-semibold">
                    Senha pessoal
                  </label>
                  <input
                    id="team-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#decace] px-4"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#633847] font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "Entrando..." : "Acessar candidaturas"}{" "}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
                <button
                  type="button"
                  className="mt-5 text-sm font-semibold text-[#79515d] underline"
                  onClick={async () => {
                    await vonixAffiliateAuth.auth.signOut();
                    setStage("email");
                    setPassword("");
                  }}
                >
                  Trocar e-mail ou recuperar acesso
                </button>
              </>
            )}
            {notice && stage !== "email" && (
              <p role="status" className="mt-5 rounded-xl bg-[#f1eee9] p-4 text-sm">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                {error}
              </p>
            )}
          </section>
          <p className="mt-6 text-center text-sm text-[#82686f]">
            <Link to="/" className="underline underline-offset-4">
              Voltar à loja Vonix Hair
            </Link>
          </p>
        </div>
      </div>
    </AffiliateShell>
  );
}
