import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Link2,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

/**
 * Public informational content only: no application data, tokens, cookies, or analytics.
 * The creator can share the public application page, not an affiliate sales link.
 */
export const PUBLIC_AFFILIATE_PAGE = "https://vonixhair.com/seja-afiliada";

const stages = [
  {
    number: "01",
    title: "Concluiu uma inscrição real?",
    description:
      "Guarde o código de acompanhamento exibido após a confirmação do cadastro. Sem confirmação de envio, não existe candidatura registrada.",
    Icon: ClipboardCheck,
  },
  {
    number: "02",
    title: "Consulte o andamento",
    description:
      "Use a página de acompanhamento com os dados solicitados. A consulta não altera sua candidatura e não exige uma nova inscrição.",
    Icon: CheckCircle2,
  },
  {
    number: "03",
    title: "Aguarde uma comunicação oficial",
    description:
      "Se sua candidatura avançar, a equipe poderá entrar em contato pelos canais informados. Não existe aprovação ou prazo de resposta garantidos.",
    Icon: MessageSquareText,
  },
] as const;

export function AffiliateNextSteps({ recruitmentOpen }: { recruitmentOpen: boolean }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyPublicLink() {
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyMessage(
          "Cópia não disponível neste navegador. Compartilhe o endereço desta página.",
        );
        return;
      }
      await navigator.clipboard.writeText(PUBLIC_AFFILIATE_PAGE);
      setCopyMessage(
        "Link público copiado. Compartilhe apenas com quem deseja conhecer a seleção.",
      );
    } catch {
      setCopyMessage("Não foi possível copiar. Você pode compartilhar o endereço desta página.");
    }
  }

  return (
    <section
      id="depois-da-inscricao"
      aria-labelledby="vonix-next-steps-title"
      data-testid="affiliate-c55-next-steps"
      className="scroll-mt-24 border-y border-border bg-secondary/30 px-5 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid items-end gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-primary">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Transparência durante a seleção
            </p>
            <h2
              id="vonix-next-steps-title"
              className="mt-5 max-w-3xl font-display text-4xl leading-tight text-foreground sm:text-5xl"
            >
              Sua candidatura tem{" "}
              <span className="italic text-primary">próximos passos claros.</span>
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-[1.85] text-muted-foreground sm:text-base">
            Antes de se inscrever, saiba como acompanhar o processo. A candidatura é gratuita, mas a
            equipe avalia cada inscrição e não há garantia de aprovação.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {stages.map(({ number, title, description, Icon }) => (
            <li
              key={number}
              className="flex min-w-0 flex-col rounded-[1.55rem] border border-border bg-card p-6 shadow-[0_12px_35px_rgba(72,36,50,.05)] sm:p-8"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-3xl text-primary">{number}</span>
                <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-7 font-display text-2xl leading-tight text-foreground">{title}</h3>
              <p className="mt-4 text-sm leading-[1.85] text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-col justify-between gap-6 rounded-[1.5rem] border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-foreground">
              {recruitmentOpen
                ? "Quando concluir sua inscrição, guarde o código recebido."
                : "Visualizar a prévia não gera um código ou uma candidatura."}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Se já concluiu uma inscrição anteriormente, utilize o acompanhamento oficial. Não
              envie dados pessoais, códigos de acesso ou senhas para outras candidatas.
            </p>
          </div>
          <a
            href="/consultar-candidatura"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:self-auto"
          >
            Acompanhar candidatura <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-border pt-7 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-foreground">
              Conhece alguém que também gostaria de participar?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Compartilhe somente a página pública da seleção. Este botão não gera link de afiliada,
              cupom ou indicação remunerada.
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-xs font-semibold text-primary"
              data-testid="affiliate-c55-copy-result"
            >
              {copyMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copyPublicLink()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Link2 aria-hidden="true" className="h-4 w-4" />
            Copiar link do programa
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
