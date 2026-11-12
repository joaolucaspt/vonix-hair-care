import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/site";
import { BfVipForm } from "@/components/bf-vip-form";
import { BF_DATA_ABERTURA, BF_FOCO, bfDiasParaAbrir, bfEsquentaAberto } from "@/lib/black-friday";
import { SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/esquenta-black-friday")({
  head: () => ({
    meta: [
      { title: "Esquenta Black Friday | Vonix Hair" },
      {
        name: "description",
        content:
          "Entre na lista VIP da Vonix Hair e saiba primeiro quando a Black Friday abrir: Botox, Progressiva Fio de Luz e kits.",
      },
      { property: "og:title", content: "Esquenta Black Friday | Vonix Hair" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/esquenta-black-friday" }],
  }),
  component: EsquentaPage,
});

function EsquentaPage() {
  const aberto = bfEsquentaAberto();
  const dias = bfDiasParaAbrir();
  return (
    <Shell>
      <div className="container-site py-8 md:py-12">
        <section className="rounded-2xl bg-[#3b0a34] p-6 text-white md:p-10">
          <p className="text-small uppercase tracking-widest text-[#e6c66a]">
            Esquenta Black Friday
          </p>
          <h1 className="mt-2 font-display text-h1 leading-tight">
            {aberto
              ? `A Black Friday abre dia ${BF_DATA_ABERTURA}`
              : "A Black Friday da Vonix Hair"}
          </h1>
          <p className="mt-3 max-w-xl text-body opacity-90">
            {aberto
              ? `Faltam ${dias} ${dias === 1 ? "dia" : "dias"}. Quem entra na lista VIP recebe o aviso em primeira mão, antes de abrir para todo mundo.`
              : "Veja as ofertas no site."}
          </p>
          {aberto ? (
            <div className="mt-6 rounded-xl bg-[oklch(0.975_0.012_88)] p-4 text-foreground md:p-5">
              <h2 className="font-display text-h2 leading-tight">Entre na lista VIP</h2>
              <p className="mb-4 mt-1 text-body text-muted-foreground">
                Só o seu e-mail. Sem spam: avisamos da Black Friday e pronto.
              </p>
              <BfVipForm />
            </div>
          ) : (
            <Link
              to="/loja"
              className="mt-6 inline-block rounded-full bg-action px-6 py-3 font-medium text-action-foreground"
            >
              Ver produtos
            </Link>
          )}
        </section>

        <section className="mt-8" aria-label="O que entra na Black Friday">
          <h2 className="font-display text-h2">O que vai ter</h2>
          <p className="mt-1 text-body text-muted-foreground">
            As ofertas ficam nos produtos que mais saem: Botox, Progressiva Fio de Luz e kits.
          </p>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {BF_FOCO.map((f) => (
              <li key={f.slug} className="rounded-xl border border-border p-4">
                <h3 className="font-semibold">{f.titulo}</h3>
                <p className="mt-1 text-body text-muted-foreground">{f.texto}</p>
                <Link
                  to="/produto/$slug"
                  params={{ slug: f.slug }}
                  className="mt-3 inline-block text-small underline"
                >
                  Ver produto
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-small text-muted-foreground">
            As condições e a data final da oferta aparecem aqui no dia {BF_DATA_ABERTURA}. Prazo
            real: quando acabar, acaba.
          </p>
        </section>
      </div>
    </Shell>
  );
}
