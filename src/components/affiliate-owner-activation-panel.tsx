import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, Link2, LockKeyhole, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import {
  createPendingAffiliateOwnerActivationLink,
  getPendingAffiliateOwnerActivations,
  inspectAffiliateOwnerSenderStatus,
  resendPendingAffiliateOwnerEmail,
  provisionPendingAffiliateOwnerTemporaryPassword,
} from "@/lib/affiliate-functions";

type PendingOwner = { email: string };
type GeneratedLink = { email: string; link: string };
type TemporaryCredentials = { email: string; password: string };

function pageHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

const senderMessages: Record<string, string> = {
  verified:
    "O domínio de envio está verificado no Resend. Isso NÃO comprova a entrega na caixa de entrada.",
  pending:
    "O domínio de envio está aguardando verificação DNS no Resend. Revise os registros no painel do provedor.",
  partially_verified:
    "A verificação DNS está incompleta. Confira os registros pendentes no Resend.",
  failed:
    "O domínio de envio falhou na verificação do Resend. Corrija os registros DNS indicados no painel.",
  partially_failed:
    "Parte da configuração DNS falhou. Confira o painel Resend antes de reenviar convites.",
  not_started:
    "O domínio ainda não iniciou a verificação no Resend. É necessário configurar o DNS.",
  "sender-invalid": "O endereço de remetente configurado é inválido. Corrija AFFILIATE_FROM_EMAIL.",
  "not-configured":
    "A chave de envio do Resend não está configurada. O fluxo pode usar Supabase Auth como alternativa.",
  "key-unauthorized":
    "A API do Resend rejeitou a chave de consulta (HTTP 401). Verifique a credencial no painel Resend; os envios também podem estar bloqueados.",
  "read-restricted":
    "Esta chave pode ter permissão somente de envio; não foi possível consultar os domínios. Verifique o estado do domínio diretamente no painel Resend. Isso não prova falha na entrega.",
  "rate-limited":
    "O Resend limitou esta consulta. Confira o domínio no painel ou tente novamente depois.",
  "provider-unavailable":
    "O diagnóstico do Resend não respondeu. Não há confirmação de domínio nem prova de falha na entrega.",
  "not-verifiable":
    "Não foi possível identificar o domínio no resultado do Resend. Confira o endereço de remetente e a verificação no painel.",
};

/**
 * Owner-only interface. Never render, log, persist or embed action links in
 * HTML attributes. Authorized owners copy a freshly generated single-use
 * Supabase Auth link to a trusted private channel for the intended member.
 */
export function AffiliateOwnerActivationPanel() {
  const [owners, setOwners] = useState<PendingOwner[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [initialError, setInitialError] = useState(false);
  const [initialRetry, setInitialRetry] = useState(0);
  const copyingLink = useRef(false);
  const visibilityEpoch = useRef(0);
  // Invalidate link generation when the intended recipient is unconfirmed.
  const recipientConfirmationEpoch = useRef(0);
  const [busy, setBusy] = useState(false);
  const [confirmedPrivateRecipient, setConfirmedPrivateRecipient] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<TemporaryCredentials | null>(null);
  const [generatedBatch, setGeneratedBatch] = useState<TemporaryCredentials[]>([]);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [senderBusy, setSenderBusy] = useState(false);
  const [senderStatus, setSenderStatus] = useState<string | null>(null);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!pageHidden()) {
        // Fresh pending-owner permissions must be re-read after the tab
        // resumes. A previous bearer link is never restored.
        setInitialRetry((version) => version + 1);
        return;
      }
      // A single-use invite is a bearer credential; revoke untransferred
      // browser state and stale async completions on shared-device tab hide.
      visibilityEpoch.current++;
      setGeneratedBatch([]);
      // A native share or clipboard Promise can remain unsettled while hidden.
      // Release its lock; callbacks from the earlier epoch cannot restore it.
      copyingLink.current = false;
      setGenerated(null);
      setGeneratedPassword(null);
      setConfirmedPrivateRecipient(false);
      setMessage("");
      setFailure("");
      setSenderStatus(null);
      setOwners(null);
      setAvailable(false);
      setBusy(false);
      setSenderBusy(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    let active = true;
    const epoch = visibilityEpoch.current;
    if (pageHidden())
      return () => {
        active = false;
      };
    void getPendingAffiliateOwnerActivations()
      .then((result) => {
        if (!active || epoch !== visibilityEpoch.current || pageHidden()) return;
        if (result.ok) {
          setInitialError(false);
          setAvailable(true);
          setOwners(result.owners);
        } else {
          // Never show invitees on failure; only the authorized server's
          // transient-failure category can expose a retry affordance.
          setAvailable(false);
          setInitialError(result.reason === "temporarily-unavailable");
        }
      })
      .catch(() => {
        if (active && epoch === visibilityEpoch.current && !pageHidden()) {
          setAvailable(false);
          // A network failure must not silently remove the owner's recovery UI.
          setInitialError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [initialRetry]);

  if (!available || owners === null)
    return initialError ? (
      <section
        aria-label="Recuperação da consulta de convites"
        className="mb-6 rounded-2xl border border-[#e7d4d3] bg-white p-5"
      >
        <p role="alert" className="text-sm text-[#7b4652]">
          Não foi possível consultar os convites. Nenhuma identidade foi exibida.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-full border border-[#cda9ad] px-5 text-sm font-semibold"
          onClick={() => {
            setInitialError(false);
            setInitialRetry((value) => value + 1);
          }}
        >
          Tentar consultar convites novamente
        </button>
      </section>
    ) : null;

  async function verifySenderWithoutEmail() {
    if (busy || senderBusy || generated || generatedBatch.length || pageHidden()) return;
    const epoch = visibilityEpoch.current;
    setSenderBusy(true);
    setSenderStatus(null);
    try {
      const result = await inspectAffiliateOwnerSenderStatus();
      // A pending Resend request cannot restore an old diagnostic after
      // owner permissions are refreshed on return from a hidden tab.
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      if (!result.ok) {
        setAvailable(false);
        setOwners(null);
        return;
      }
      setSenderStatus(result.diagnosis.status);
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setSenderStatus("provider-unavailable");
    } finally {
      if (epoch === visibilityEpoch.current && !pageHidden()) setSenderBusy(false);
    }
  }

  async function reload() {
    if (generatedBatch.length) return;
    if (busy || pageHidden()) return;
    const epoch = visibilityEpoch.current;
    setBusy(true);
    setGenerated(null);
    setMessage("");
    setFailure("");
    try {
      const result = await getPendingAffiliateOwnerActivations();
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      if (!result.ok) {
        setAvailable(false);
        setOwners(null);
        // The server may distinguish temporary failures only after owner authorization.
        setInitialError(result.reason === "temporarily-unavailable");
        return;
      }
      setInitialError(false);
      setOwners(result.owners);
    } catch {
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      setAvailable(false);
      setOwners(null);
      setInitialError(true);
    } finally {
      if (epoch === visibilityEpoch.current) setBusy(false);
    }
  }

  async function create(email: string) {
    if (
      !confirmedPrivateRecipient ||
      busy ||
      generated ||
      generatedPassword ||
      generatedBatch.length ||
      pageHidden()
    )
      return;
    const epoch = visibilityEpoch.current;
    const confirmedEpoch = recipientConfirmationEpoch.current;
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const result = await createPendingAffiliateOwnerActivationLink({ data: { email } });
      if (
        epoch !== visibilityEpoch.current ||
        confirmedEpoch !== recipientConfirmationEpoch.current ||
        pageHidden()
      )
        return;
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      setGenerated({ email: result.recipient, link: result.link });
      setMessage(
        "Link individual gerado. Copie ou compartilhe somente com o destinatário autorizado.",
      );
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setFailure("Não foi possível gerar o link. Tente novamente após conferir a sessão.");
    } finally {
      if (epoch === visibilityEpoch.current) setBusy(false);
    }
  }

  async function sendInvitationEmail(email: string) {
    if (generatedBatch.length) return;
    if (busy || generated || generatedPassword || pageHidden()) return;
    const epoch = visibilityEpoch.current;
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const response = await resendPendingAffiliateOwnerEmail({ data: { email } });
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      if (!response.ok) {
        setFailure(response.reason);
        return;
      }
      setMessage(
        "Convite solicitado ao provedor para " +
          email +
          ". A aceitação não garante entrega: a pessoa precisa abrir o e-mail, confirmar e criar a própria senha. Confira entrada, spam e promoções.",
      );
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setFailure("Não foi possível solicitar o e-mail. Verifique sua conexão.");
    } finally {
      if (epoch === visibilityEpoch.current) setBusy(false);
    }
  }

  async function generateTemporaryPassword(email: string) {
    if (
      busy ||
      generated ||
      generatedPassword ||
      generatedBatch.length ||
      pageHidden() ||
      !confirmedPrivateRecipient
    )
      return;
    const epoch = visibilityEpoch.current;
    const confirmedEpoch = recipientConfirmationEpoch.current;
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const response = await provisionPendingAffiliateOwnerTemporaryPassword({ data: { email } });
      if (
        epoch !== visibilityEpoch.current ||
        confirmedEpoch !== recipientConfirmationEpoch.current ||
        pageHidden()
      )
        return;
      if (!response.ok) {
        setFailure(response.reason);
        return;
      }
      setGeneratedPassword({ email: response.email, password: response.temporaryPassword });
      setOwners((current) => current?.filter((person) => person.email !== response.email) ?? null);
      setMessage(
        "Senha temporária criada. Copie uma única vez e entregue somente ao destinatário. A conta exigirá uma nova senha no primeiro login.",
      );
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setFailure(
          "Falha no provisionamento. Verifique a sessão administrativa e tente novamente.",
        );
    } finally {
      if (epoch === visibilityEpoch.current) setBusy(false);
    }
  }

  /** Owner-reviewed batch: each password remains browser-memory-only until copied. */
  async function regenerateThreeOwnerPasswords() {
    if (
      busy ||
      generated ||
      generatedPassword ||
      generatedBatch.length ||
      pageHidden() ||
      !confirmedPrivateRecipient
    )
      return;
    const epoch = visibilityEpoch.current;
    const confirmedEpoch = recipientConfirmationEpoch.current;
    const current = () =>
      epoch === visibilityEpoch.current &&
      confirmedEpoch === recipientConfirmationEpoch.current &&
      !pageHidden();
    setBusy(true);
    setFailure("");
    setMessage("");
    const ready: TemporaryCredentials[] = [];
    const targets = [
      "isabela.cpcontato@gmail.com",
      "giovana.souza1.r@gmail.com",
      "lucassiqueirahotmail22@gmail.com",
    ] as const;
    try {
      for (const email of targets) {
        if (!current()) return;
        const response = await provisionPendingAffiliateOwnerTemporaryPassword({ data: { email } });
        if (!current()) return;
        if (!response.ok || response.email !== email) {
          setFailure(
            "Não foi possível gerar todas as senhas. Copie primeiro os acessos que aparecerem; " +
              "depois recupere individualmente os restantes.",
          );
          break;
        }
        ready.push({ email: response.email, password: response.temporaryPassword });
        setGeneratedBatch([...ready]);
        setOwners((prev) => prev?.filter((person) => person.email !== email) ?? null);
      }
      if (current() && ready.length === targets.length) {
        setMessage(
          "As três senhas foram renovadas. Copie todos os acessos antes de sair desta aba. " +
            "Cada titular deverá trocar sua senha no primeiro login.",
        );
      }
    } catch {
      if (current()) {
        setFailure(
          "O provisionamento foi interrompido. Copie os acessos já exibidos " +
            "e recupere individualmente os demais.",
        );
      }
    } finally {
      if (epoch === visibilityEpoch.current) setBusy(false);
    }
  }

  async function copyBatchCredentials() {
    if (busy || !generatedBatch.length || copyingLink.current || pageHidden()) return;
    const epoch = visibilityEpoch.current;
    copyingLink.current = true;
    setBusy(true);
    setFailure("");
    try {
      const payload = generatedBatch
        .map(({ email, password }) => email + "\nSenha provisória: " + password)
        .join("\n\n");
      await navigator.clipboard.writeText(payload);
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      setGeneratedBatch([]);
      setMessage(
        "Acessos copiados. Cole-os somente em um local privado e envie cada senha " +
          "ao destinatário correto. Apague a cópia quando terminar.",
      );
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setFailure("Cópia bloqueada. Selecione as credenciais exibidas para copiar manualmente.");
    } finally {
      if (epoch === visibilityEpoch.current) {
        copyingLink.current = false;
        setBusy(false);
      }
    }
  }

  async function copyTemporaryPassword() {
    if (!generatedPassword || busy || pageHidden() || copyingLink.current) return;
    const epoch = visibilityEpoch.current;
    copyingLink.current = true;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(generatedPassword.password);
      if (epoch !== visibilityEpoch.current || pageHidden()) return;
      setGeneratedPassword(null);
      setMessage(
        "Senha provisória copiada. Entregue-a em uma mensagem privada ao titular; ela deve ser trocada no primeiro login.",
      );
    } catch {
      if (epoch === visibilityEpoch.current && !pageHidden())
        setFailure(
          "A cópia foi bloqueada pelo navegador. Selecione a senha exibida e copie manualmente.",
        );
    } finally {
      if (epoch === visibilityEpoch.current) {
        copyingLink.current = false;
        setBusy(false);
      }
    }
  }

  async function shareNative() {
    // Native share is available in secure mobile contexts and is an explicit
    // owner gesture. The private token is never embedded in HTML or analytics.
    if (
      !generated ||
      !confirmedPrivateRecipient ||
      busy ||
      copyingLink.current ||
      typeof navigator.share !== "function"
    )
      return;
    const epoch = visibilityEpoch.current;
    const confirmedEpoch = recipientConfirmationEpoch.current;
    copyingLink.current = true;
    setBusy(true);
    setFailure("");
    try {
      await navigator.share({ title: "Convite individual Vonix Hair", url: generated.link });
      if (
        epoch !== visibilityEpoch.current ||
        confirmedEpoch !== recipientConfirmationEpoch.current ||
        pageHidden()
      )
        return;
      setGenerated(null);
      setMessage(
        "Compartilhamento aberto no dispositivo. Isso não comprova que o destinatário recebeu; confirme o envio no aplicativo escolhido.",
      );
    } catch (error) {
      if (
        epoch !== visibilityEpoch.current ||
        confirmedEpoch !== recipientConfirmationEpoch.current ||
        pageHidden()
      )
        return;
      if (error instanceof Error && error.name === "AbortError") {
        setMessage(
          "Compartilhamento cancelado. O link ainda está disponível para copiar ou compartilhar em privado.",
        );
      } else {
        setFailure(
          "Não foi possível abrir o compartilhamento. Tente copiar o link para envio privado.",
        );
      }
    } finally {
      // Old callbacks must not release a newer copy/share operation.
      if (epoch === visibilityEpoch.current) {
        copyingLink.current = false;
        setBusy(false);
      }
    }
  }

  async function copy() {
    if (!generated || !confirmedPrivateRecipient || busy || copyingLink.current || pageHidden())
      return;
    const epoch = visibilityEpoch.current;
    const confirmedEpoch = recipientConfirmationEpoch.current;
    copyingLink.current = true;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(generated.link);
      if (
        epoch !== visibilityEpoch.current ||
        confirmedEpoch !== recipientConfirmationEpoch.current ||
        pageHidden()
      )
        return;
      setGenerated(null);
      setMessage(
        "Link copiado. Envie-o agora, em conversa privada com a pessoa certa. Ele é de uso único e deixa de ser exibido aqui.",
      );
    } catch {
      if (
        epoch === visibilityEpoch.current &&
        confirmedEpoch === recipientConfirmationEpoch.current &&
        !pageHidden()
      )
        setFailure(
          "O navegador bloqueou a cópia. Permita o acesso à área de transferência e clique novamente.",
        );
    } finally {
      // Old callbacks must not release a newer copy/share operation.
      if (epoch === visibilityEpoch.current) {
        copyingLink.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <section
      aria-label="Ativar proprietários sem depender do e-mail"
      className="mb-6 rounded-[1.5rem] border border-[#d9bfc3] bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8e5263]">
            <ShieldCheck className="h-4 w-4" />
            Somente proprietários autenticados
          </div>
          <h2 className="font-display text-2xl">Ativar convites pendentes</h2>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d9c1c5] px-4 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#806a6c]">
        Para cada membro que ainda não ativou a conta, reenvie o convite por e-mail corporativo. A
        pessoa abre o link privado, confirma a ativação e cria uma senha própria. Se não receber,
        também é possível gerar um link Supabase e compartilhá-lo em conversa individual segura. Não
        envie links em grupos. O aceite do provedor não comprova a entrega nem a leitura.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void verifySenderWithoutEmail()}
          disabled={busy || senderBusy || !!generated}
          className="min-h-11 rounded-full border border-[#cdaeb5] bg-[#faf2f0] px-5 text-sm font-semibold text-[#633845] disabled:opacity-50"
        >
          {senderBusy ? "Consultando Resend..." : "Verificar domínio do e-mail sem enviar"}
        </button>
        <p className="text-xs text-[#806a6c]">
          Apenas leitura. Nenhum convite, OTP ou mensagem é enviado neste teste.
        </p>
      </div>
      {senderStatus && (
        <p
          role="status"
          aria-label="Diagnóstico do remetente de convites"
          className="mt-3 rounded-xl border border-[#e8d9d5] bg-[#fffaf7] p-4 text-sm text-[#734750]"
        >
          {senderMessages[senderStatus] ?? "Diagnóstico indisponível. Consulte o painel Resend."}
        </p>
      )}
      <div className="mt-5 rounded-xl border border-[#ebdadc] bg-[#fcf8f7] p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={confirmedPrivateRecipient}
            onChange={(event) => {
              recipientConfirmationEpoch.current++;
              const isConfirmed = event.target.checked;
              setConfirmedPrivateRecipient(isConfirmed);
              if (!isConfirmed) {
                setGeneratedBatch([]);
                // Remove the unused bearer link from the UI immediately;
                // checking the box again requires generating a fresh link.
                setGenerated(null);
                setMessage("");
                setFailure("");
              }
            }}
            className="mt-1 h-4 w-4 accent-[#693440]"
          />
          Confirmo que conheço os destinatários, vou conferir a identidade de cada pessoa e enviar
          cada link ou senha provisória somente ao seu destinatário confirmado.
        </label>
      </div>
      {owners.length === 0 ? (
        <p role="status" className="mt-4 text-sm font-medium text-[#5d6950]">
          Nenhum convite de proprietário pendente.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {owners.map((person) => (
            <li
              key={person.email}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ecddde] p-4"
            >
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">{person.email}</p>
                <p className="mt-1 text-xs text-[#806a6c]">Convite ainda não ativado</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    busy || !!generated || !!generatedPassword || !confirmedPrivateRecipient
                  }
                  onClick={() => void generateTemporaryPassword(person.email)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#633847] bg-[#faf2ef] px-5 text-sm font-bold text-[#633847] disabled:opacity-50"
                >
                  <LockKeyhole className="h-4 w-4" />
                  Criar senha temporária
                </button>
                <button
                  type="button"
                  onClick={() => void sendInvitationEmail(person.email)}
                  disabled={busy || !!generated}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#693440] px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Reenviar convite por e-mail
                </button>
                <button
                  type="button"
                  onClick={() => void create(person.email)}
                  disabled={busy || !!generated || !confirmedPrivateRecipient}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#cfaeb4] px-5 text-sm font-bold text-[#693440] disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  Gerar link individual
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 rounded-xl border border-[#d5b5bb] bg-[#fcf7f5] p-5">
        <h3 className="font-display text-xl">Entregar os três acessos juntos</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#806a6c]">
          Renova as senhas provisórias das três contas já autorizadas e mostra cada e-mail com sua
          senha para cópia única. Senhas anteriores deixam de funcionar. Não navegue para outra aba
          antes de copiar: por segurança, os dados serão ocultados.
        </p>
        <button
          type="button"
          disabled={
            busy ||
            !!generated ||
            !!generatedPassword ||
            generatedBatch.length > 0 ||
            !confirmedPrivateRecipient
          }
          onClick={() => void regenerateThreeOwnerPasswords()}
          className="mt-4 min-h-12 w-full rounded-full bg-[#633847] px-5 font-semibold text-white disabled:opacity-60"
        >
          <LockKeyhole className="mr-2 inline h-4 w-4" />
          {busy ? "Gerando credenciais..." : "Gerar e reunir as 3 senhas temporárias"}
        </button>
      </div>
      {generatedBatch.length > 0 && (
        <div
          role="region"
          aria-label="Credenciais temporárias geradas para entrega privada"
          className="mt-4 rounded-xl border border-[#ccb2b6] bg-white p-5"
        >
          <h3 className="font-display text-xl">
            Credenciais individuais: {generatedBatch.length} de 3
          </h3>
          <p className="mt-2 text-sm text-[#806a6c]">
            Confirme cada destinatário antes de compartilhar. A senha expira após a troca
            obrigatória no primeiro acesso ao painel.
          </p>
          <div className="mt-4 space-y-3">
            {generatedBatch.map(({ email, password }) => (
              <div key={email} className="rounded-lg border border-[#e9dadd] bg-[#fcf8f7] p-3">
                <p className="break-all text-sm font-semibold">{email}</p>
                <code className="mt-2 block select-all break-all rounded-lg bg-white p-3 text-sm">
                  {password}
                </code>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyBatchCredentials()}
            className="mt-4 min-h-12 w-full rounded-full bg-[#633847] px-4 font-semibold text-white disabled:opacity-60"
          >
            <ClipboardCopy className="mr-2 inline h-4 w-4" />
            Copiar {generatedBatch.length} {generatedBatch.length === 1 ? "acesso" : "acessos"} e
            ocultar senhas
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setGeneratedBatch([])}
            className="mt-3 min-h-11 w-full rounded-full border border-[#cda9ad] px-4 text-sm font-semibold disabled:opacity-60"
          >
            Ocultar sem copiar
          </button>
        </div>
      )}
      <details className="mt-4 rounded-xl border border-[#ebdadc] bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#704953]">
          Recuperar senha provisória que não foi copiada
        </summary>
        <p className="mt-3 text-xs text-[#806a6c]">
          Disponível apenas para convites pendentes ou senhas provisórias ainda não trocadas. A
          reemissão invalida a senha anterior e pode exigir o intervalo de segurança.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              "isabela.cpcontato@gmail.com",
              "giovana.souza1.r@gmail.com",
              "lucassiqueirahotmail22@gmail.com",
            ] as const
          ).map((email) => (
            <button
              key={email}
              type="button"
              onClick={() => void generateTemporaryPassword(email)}
              disabled={
                busy ||
                !!generated ||
                !!generatedPassword ||
                !!generatedBatch.length ||
                !confirmedPrivateRecipient
              }
              className="min-h-11 rounded-xl border border-[#ceb6b8] px-4 py-2 text-xs font-semibold text-[#693440] disabled:opacity-50"
            >
              {email}
            </button>
          ))}
        </div>
      </details>
      {generatedPassword && (
        <div className="mt-4 rounded-xl border border-[#d5c1c3] bg-[#faf4f2] p-4">
          <h3 className="font-display text-xl">Senha provisória individual</h3>
          <p className="mt-2 break-all text-sm font-semibold">{generatedPassword.email}</p>
          <p className="mt-2 text-sm text-[#806a6c]">
            Copie a senha e entregue ao titular em canal privado. O sistema exigirá uma senha
            própria antes de permitir o acesso ao painel.
          </p>
          <code className="mt-4 block break-all rounded-lg bg-white p-3 text-sm font-semibold select-all">
            {generatedPassword.password}
          </code>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void copyTemporaryPassword()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#633847] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              <ClipboardCopy className="h-4 w-4" />
              Copiar e ocultar senha
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setGeneratedPassword(null)}
              className="min-h-11 rounded-full border border-[#cda9ad] px-5 text-sm font-semibold disabled:opacity-50"
            >
              Ocultar sem copiar
            </button>
          </div>
        </div>
      )}
      {generated && (
        <div className="mt-4 rounded-xl border border-[#d5c1c3] bg-[#faf4f2] p-4">
          <p className="break-all text-sm font-semibold">{generated.email}</p>
          <p className="mt-2 text-sm text-[#806a6c]">
            Link gerado para esta conta. Copie ou compartilhe em conversa privada com o destinatário
            confirmado. O endereço não é exibido na página e será retirado da tela após a
            transferência.
          </p>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={() => void shareNative()}
              disabled={busy || !confirmedPrivateRecipient}
              className="mt-4 mr-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#b18f9a] bg-[#fff9f5] px-5 text-sm font-bold text-[#693440] disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar link individual no celular
            </button>
          )}
          <button
            type="button"
            onClick={() => void copy()}
            disabled={busy}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#693440] px-5 text-sm font-bold text-white"
          >
            <ClipboardCopy className="h-4 w-4" />
            Copiar link para compartilhar em privado
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm font-medium text-[#43624c]">
          {message}
        </p>
      )}
      {failure && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700">
          {failure}
        </p>
      )}
      <p className="mt-5 flex items-start gap-2 text-xs text-[#82686f]">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        Nenhum acesso é concedido ao gerar o link. A ativação só ocorre depois que o destinatário
        usa o token no Supabase e define uma senha exclusiva, que deve permanecer privada.
      </p>
    </section>
  );
}
