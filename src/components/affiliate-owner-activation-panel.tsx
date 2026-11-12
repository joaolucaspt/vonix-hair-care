import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, Link2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import {
  createPendingAffiliateOwnerActivationLink,
  getPendingAffiliateOwnerActivations,
  resendPendingAffiliateOwnerEmail,
} from "@/lib/affiliate-functions";

type PendingOwner = { email: string };
type GeneratedLink = { email: string; link: string };

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
  const [busy, setBusy] = useState(false);
  const [confirmedPrivateRecipient, setConfirmedPrivateRecipient] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let active = true;
    void getPendingAffiliateOwnerActivations()
      .then((result) => {
        if (!active) return;
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
        if (active) {
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

  async function reload() {
    if (busy) return;
    setBusy(true);
    setGenerated(null);
    setMessage("");
    setFailure("");
    try {
      const result = await getPendingAffiliateOwnerActivations();
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
      setAvailable(false);
      setOwners(null);
      setInitialError(true);
    } finally {
      setBusy(false);
    }
  }

  async function create(email: string) {
    if (!confirmedPrivateRecipient || busy || generated) return;
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const result = await createPendingAffiliateOwnerActivationLink({ data: { email } });
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      setGenerated({ email: result.recipient, link: result.link });
      setMessage("Link individual gerado. Copie e envie somente para o destinatário autorizado.");
    } catch {
      setFailure("Não foi possível gerar o link. Tente novamente após conferir a sessão.");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvitationEmail(email: string) {
    if (busy || generated) return;
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const response = await resendPendingAffiliateOwnerEmail({ data: { email } });
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
      setFailure("Não foi possível solicitar o e-mail. Verifique sua conexão.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!generated || busy || copyingLink.current) return;
    copyingLink.current = true;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(generated.link);
      setGenerated(null);
      setMessage(
        "Link copiado. Envie-o agora, em conversa privada com a pessoa certa. Ele é de uso único e deixa de ser exibido aqui.",
      );
    } catch {
      setFailure(
        "O navegador bloqueou a cópia. Permita o acesso à área de transferência e clique novamente.",
      );
    } finally {
      copyingLink.current = false;
      setBusy(false);
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
      <div className="mt-5 rounded-xl border border-[#ebdadc] bg-[#fcf8f7] p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={confirmedPrivateRecipient}
            onChange={(event) => setConfirmedPrivateRecipient(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#693440]"
          />
          Confirmo que conheço os destinatários, vou conferir a identidade de cada pessoa e enviar
          cada link somente ao seu contato privado.
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
      {generated && (
        <div className="mt-4 rounded-xl border border-[#d5c1c3] bg-[#faf4f2] p-4">
          <p className="break-all text-sm font-semibold">{generated.email}</p>
          <p className="mt-2 text-sm text-[#806a6c]">
            Link gerado para esta conta. Copie agora. O endereço não será exibido na página e será
            apagado da tela assim que a cópia for concluída.
          </p>
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
