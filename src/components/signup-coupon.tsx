import { Link } from "@tanstack/react-router";
import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { track } from "@/lib/analytics";
import { SIGNUP_COUPON, findCoupon, getPrize, savePrize } from "@/lib/coupons";
import { registerLead } from "@/lib/leads.functions";

const DONE_KEY = "vonix-cadastro-confirmado-v2";
const DONE_EVENT = "vonix:cadastro";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Cadastro com cupom de boas-vindas (5% OFF em itens sem outra oferta).
 * O cupom aparece na hora e é aplicado sozinho no checkout, a não ser que a pessoa já tenha um cupom melhor.
 * `dark` = versão para fundo escuro (rodapé); `compact` = só o essencial, sem título grande.
 */
export function SignupCoupon({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [isca, setIsca] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  const coupon = findCoupon(SIGNUP_COUPON);
  const register = useServerFn(registerLead);

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) setState("done");
    } catch {
      /* sem storage: o formulário aparece normalmente */
    }
    // O mesmo cadastro aparece em mais de um lugar da página: quando um é preenchido, os outros acompanham.
    const done = () => setState("done");
    window.addEventListener(DONE_EVENT, done);
    return () => window.removeEventListener(DONE_EVENT, done);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending" || !coupon) return;
    if (!EMAIL.test(email.trim()))
      return setError("Digite um e-mail válido, por exemplo nome@email.com.");
    setError(null);
    setState("sending");
    try {
      const result = await register({
        data: {
          ...(nome.trim() ? { nome: nome.trim() } : {}),
          email: email.trim(),
          ...(isca ? { empresa: isca } : {}),
        },
      });
      if (!result.ok || !result.saved) {
        setState("idle");
        setError(
          "message" in result
            ? result.message
            : "Não foi possível confirmar seu cadastro. Tente novamente mais tarde.",
        );
        return;
      }
      const have = getPrize();
      if (have && (have.percent ?? 0) >= (coupon.percent ?? 0)) setKept(have.code);
      else savePrize(coupon.code);
      try {
        localStorage.setItem(DONE_KEY, "1");
      } catch {
        /* ok */
      }
      track("sign_up", { method: "cupom_boas_vindas" });
      setState("done");
      window.dispatchEvent(new Event(DONE_EVENT));
    } catch {
      setState("idle");
      setError("Não foi possível fazer o cadastro agora. Tente de novo em instantes.");
    }
  };

  if (!coupon) return null;

  const copy = () => {
    navigator.clipboard
      ?.writeText(coupon.code)
      .then(() => toast.success(`Cupom ${coupon.code} copiado`))
      .catch(() => undefined);
  };

  const wrap = dark
    ? "text-marquee-foreground"
    : "rounded-2xl border border-border bg-[oklch(0.975_0.012_88)] p-5 text-foreground md:p-7";
  const input = `h-11 w-full min-w-0 rounded-full border px-4 text-body outline-none focus:ring-2 focus:ring-[#c9992f] ${dark ? "border-transparent bg-white text-foreground" : "border-border bg-white"}`;

  return (
    <section aria-label="Cadastro com cupom de 5%" className={wrap}>
      {!compact && (
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c9992f] text-white">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-h2 leading-tight">Cadastre-se e ganhe 5% OFF</h2>
            <p className="mt-1 text-body opacity-80">
              Receba novidades e ofertas da Vonix Hair. Cupom de 5% para itens sem outra oferta,
              liberado após a confirmação do cadastro.
            </p>
          </div>
        </div>
      )}
      {compact && <h4 className="mb-1 font-semibold">Cadastre-se e ganhe 5% OFF</h4>}

      {state === "done" ? (
        <div role="status" className="rounded-xl bg-[#eef8f2] p-4 text-[#1f5a45]">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="h-5 w-5" aria-hidden="true" /> Cadastro feito!
          </div>
          <p className="mt-1 text-body">
            Seu cupom de 5% OFF:{" "}
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold tracking-wide"
              aria-label={`Copiar o cupom ${coupon.code}`}
            >
              {coupon.code} <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </p>
          <p className="mt-1 text-small opacity-80">
            {kept
              ? `Você já tinha o cupom ${kept}, que é melhor ou igual e continua aplicado. O ${coupon.code} fica guardado para você digitar no checkout.`
              : "Ele fica disponível por 7 dias neste aparelho e aparece no checkout. Não soma com descontos de quantidade; só reduz o preço dos itens elegíveis."}
          </p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-[1fr_1.2fr_auto]"}
        >
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label>
              Empresa
              <input
                tabIndex={-1}
                autoComplete="off"
                value={isca}
                onChange={(e) => setIsca(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="sr-only">Seu nome</span>
            <input
              className={input}
              placeholder="Seu nome (opcional)"
              autoComplete="given-name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="sr-only">Seu e-mail</span>
            <input
              className={input}
              type="email"
              inputMode="email"
              placeholder="Seu e-mail"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={160}
              required
            />
          </label>
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-11 rounded-full bg-action px-6 font-medium text-action-foreground disabled:opacity-60"
          >
            {state === "sending" ? "Enviando…" : "Quero meu cupom"}
          </button>
          {error && (
            <p
              role="alert"
              className={`text-small md:col-span-3 ${dark ? "text-[#ffb4a8]" : "text-destructive"}`}
            >
              {error}
            </p>
          )}
          <p className={`text-small opacity-70 md:col-span-3`}>
            Ao se cadastrar você aceita receber novidades por e-mail e pode sair quando quiser. Veja
            a{" "}
            <Link to="/$page" params={{ page: "politica-de-privacidade" }} className="underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </form>
      )}
    </section>
  );
}
