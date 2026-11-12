import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { track } from "@/lib/analytics";
import { BF_GRUPO_VIP } from "@/lib/black-friday";
import { registerLead } from "@/lib/leads.functions";

export const VIP_DONE_KEY = "vonix-bf-vip-confirmado";
const DONE_EVENT = "vonix:bf-vip";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** WhatsApp do Brasil: DDD + 8 ou 9 dígitos (aceita +55, parênteses, espaço e traço). */
export const validWhatsapp = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return (d.length === 10 || d.length === 11) && !d.startsWith("0") && !/^(\d)\1+$/.test(d);
};

/**
 * Lista VIP do esquenta da Black Friday: nome (opcional), e-mail e WhatsApp.
 * Só confirma depois que o contato foi salvo de verdade (mesmo caminho do cadastro do site).
 * Não promete cupom: promete o aviso em primeira mão e o convite para o grupo VIP.
 */
export function BfVipForm({ compact = false }: { compact?: boolean }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whats, setWhats] = useState("");
  const [isca, setIsca] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const register = useServerFn(registerLead);

  useEffect(() => {
    try {
      if (localStorage.getItem(VIP_DONE_KEY)) setState("done");
    } catch {
      /* sem armazenamento: o formulário aparece normalmente */
    }
    const done = () => setState("done");
    window.addEventListener(DONE_EVENT, done);
    return () => window.removeEventListener(DONE_EVENT, done);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!EMAIL.test(email.trim())) return setError("Digite um e-mail válido, por exemplo nome@email.com.");
    if (!validWhatsapp(whats)) return setError("Digite seu WhatsApp com DDD, por exemplo (31) 99999-9999.");
    setError(null);
    setState("sending");
    try {
      const result = await register({
        data: {
          ...(nome.trim() ? { nome: nome.trim() } : {}),
          email: email.trim(),
          telefone: whats.trim(),
          origem: "esquenta-black-friday",
          ...(isca ? { empresa: isca } : {}),
        },
      });
      if (!result.ok || !result.saved) {
        setState("idle");
        setError("message" in result ? result.message : "Não foi possível confirmar seu cadastro. Tente novamente mais tarde.");
        return;
      }
      try {
        localStorage.setItem(VIP_DONE_KEY, "1");
      } catch {
        /* ok */
      }
      track("sign_up", { method: "esquenta_black_friday" });
      setState("done");
      window.dispatchEvent(new Event(DONE_EVENT));
    } catch {
      setState("idle");
      setError("Não foi possível fazer o cadastro agora. Tente de novo em instantes.");
    }
  };

  if (state === "done") {
    return (
      <div role="status" className="rounded-xl bg-[#eef8f2] p-4 text-[#1f5a45]">
        <div className="flex items-center gap-2 font-semibold">
          <Check className="h-5 w-5" aria-hidden="true" /> Você está na lista VIP!
        </div>
        <p className="mt-1 text-body">Vamos avisar você em primeira mão quando a Black Friday abrir.</p>
        {BF_GRUPO_VIP && (
          <a href={BF_GRUPO_VIP} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-[#1f5a45] px-5 py-2.5 font-medium text-white">
            Entrar no grupo VIP no WhatsApp
          </a>
        )}
      </div>
    );
  }

  const input = "h-11 w-full min-w-0 rounded-full border border-border bg-white px-4 text-body text-foreground outline-none focus:ring-2 focus:ring-[#c9992f]";
  return (
    <form onSubmit={submit} noValidate className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Empresa
          <input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="sr-only">Seu nome</span>
        <input className={input} placeholder="Seu nome (opcional)" autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </label>
      <label className="block">
        <span className="sr-only">Seu e-mail</span>
        <input className={input} type="email" inputMode="email" placeholder="Seu e-mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} required />
      </label>
      <label className="block">
        <span className="sr-only">Seu WhatsApp com DDD</span>
        <input className={input} type="tel" inputMode="tel" placeholder="Seu WhatsApp com DDD" autoComplete="tel" value={whats} onChange={(e) => setWhats(e.target.value)} maxLength={25} required />
      </label>
      <button type="submit" disabled={state === "sending"} className="h-11 rounded-full bg-action px-6 font-medium text-action-foreground disabled:opacity-60">
        {state === "sending" ? "Enviando…" : "Entrar na lista VIP"}
      </button>
      {error && (
        <p role="alert" className="text-small text-destructive md:col-span-2">
          {error}
        </p>
      )}
      <p className="text-small opacity-70 md:col-span-2">
        Ao entrar, você aceita receber avisos da Black Friday por e-mail e WhatsApp e pode sair quando quiser. Veja a{" "}
        <Link to="/$page" params={{ page: "politica-de-privacidade" }} className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}
