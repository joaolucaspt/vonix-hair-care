import { useEffect, useState } from "react";
import { ClipboardCopy, Link2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import {
  createPendingAffiliateOwnerActivationLink,
  getPendingAffiliateOwnerActivations,
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
          setAvailable(true);
          setOwners(result.owners);
        }
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!available || owners === null) return null;

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
        return;
      }
      setOwners(result.owners);
    } catch {
      setFailure("Não foi possível atualizar as contas. Verifique sua conexão e sessão.");
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

  async function copy() {
    if (!generated) return;
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
        O envio de e-mail pode estar indisponível. Você pode gerar um link de autenticação
        individual do Supabase para cada conta já convidada e compartilhá-lo em uma conversa
        privada, como WhatsApp individual. O link é de uso único e expira. A pessoa deve criar sua
        própria senha. Não envie em grupos, não compartilhe senhas e confirme antes quem receberá o
        link.
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
              <button
                type="button"
                onClick={() => void create(person.email)}
                disabled={busy || !!generated || !confirmedPrivateRecipient}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#693440] px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                Gerar link individual
              </button>
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
