import {
  Check,
  ClipboardCheck,
  HeartHandshake,
  Instagram,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

const preparation = [
  {
    title: "Seus dados de contato",
    detail: "Nome completo, e-mail válido e telefone com DDD para contato da equipe.",
    Icon: Phone,
  },
  {
    title: "Endereço completo",
    detail: "CEP, rua, número, bairro, cidade e estado, conforme o formulário.",
    Icon: MapPin,
  },
  {
    title: "Seu Instagram",
    detail: "Nome de usuário e quantidade aproximada de seguidores.",
    Icon: Instagram,
  },
  {
    title: "TikTok, se você tiver",
    detail: "É opcional. Não impede que você apresente sua candidatura.",
    Icon: HeartHandshake,
  },
] as const;

/** Public editorial-only guide. This component never reads or stores applicant data. */
export function AffiliateApplicationPrep() {
  return (
    <aside
      aria-labelledby="vonix-c54-prep-title"
      className="mx-auto mb-12 max-w-5xl overflow-hidden rounded-[1.7rem] border border-[#dfcbd0] bg-[#fcf6f2] shadow-[0_12px_35px_rgba(81,44,57,.06)]"
      data-testid="affiliate-c54-preparation"
    >
      <div className="grid gap-6 bg-[#ead7d5] px-6 py-7 sm:grid-cols-[1fr_auto] sm:items-end sm:px-9">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#85535f]">
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
            Antes de começar
          </p>
          <h3
            id="vonix-c54-prep-title"
            className="mt-3 font-display text-3xl leading-tight text-[#4e2b3a] sm:text-4xl"
          >
            Sua candidatura pode ser simples.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-[1.8] text-[#75535f]">
            Deixe essas informações por perto e preencha o formulário com tranquilidade. Não é
            necessário criar um portfólio só para se candidatar.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#caa9af] bg-white/85 px-4 py-2 text-xs font-semibold text-[#66404e] sm:self-end">
          <Check aria-hidden="true" className="h-4 w-4" />
          Inscrição gratuita
        </span>
      </div>
      <ul className="grid gap-px bg-[#e8d8d4] sm:grid-cols-2">
        {preparation.map(({ title, detail, Icon }) => (
          <li key={title} className="flex min-w-0 items-start gap-4 bg-[#fffcfa] p-5 sm:p-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1e0df] text-[#7d4d5a]">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#4f303b]">{title}</p>
              <p className="mt-2 text-sm leading-[1.75] text-[#80626b]">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-start gap-3 bg-[#fbf4f0] px-6 py-5 sm:px-9">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#805360]" />
        <p className="max-w-3xl text-xs leading-[1.85] text-[#745762]">
          O cadastro não garante aprovação. Antes de enviar, confira os dados e leia a{" "}
          <a
            href="/politica-de-privacidade"
            className="font-semibold underline decoration-[#b78593] underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Política de Privacidade
          </a>
          . Se concluir a candidatura, guarde o código de acompanhamento.
        </p>
      </div>
    </aside>
  );
}
