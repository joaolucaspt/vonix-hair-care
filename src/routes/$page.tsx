import { createFileRoute, notFound } from "@tanstack/react-router";
import { Md, Page, Shell } from "@/components/site";
import pages from "@/data/pages.json";
import { SITE_URL } from "@/lib/store";

const P = pages as Record<string, string>;
const TITLES: Record<string, string> = {
  sobre: "Sobre a Vonix Hair",
  contato: "Contato",
  "politica-de-privacidade": "Política de Privacidade",
  "termos-de-uso": "Termos de Uso",
  "politica-de-trocas-e-devolucoes": "Política de Trocas e Devoluções",
  "politica-de-frete": "Política de Frete e Entrega",
};

const DESCRIPTIONS: Record<string, string> = {
  sobre: "Conheça a Vonix Hair: cosméticos capilares profissionais para cabeleireiras e para quem cuida dos fios em casa.",
  contato: "Fale com a Vonix Hair pelo WhatsApp ou e-mail: dúvidas sobre produtos, pedidos, entrega e trocas.",
  "politica-de-privacidade": "Como a Vonix Hair coleta, usa e protege seus dados pessoais, conforme a LGPD.",
  "termos-de-uso": "Termos de uso da loja Vonix Hair: regras de compra, preços, pagamento e entrega.",
  "politica-de-trocas-e-devolucoes": "Direito de arrependimento em 7 dias, produto com defeito, errado ou avariado: como pedir troca ou devolução na Vonix Hair.",
  "politica-de-frete": "Prazos, valores e frete grátis acima de R$ 150 sujeito à cotação do CEP: veja como funciona a entrega da Vonix Hair.",
};

export const Route = createFileRoute("/$page")({
  loader: ({ params }) => {
    if (!P[params.page]) throw notFound();
    return { slug: params.page, text: P[params.page]! };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${TITLES[loaderData.slug] ?? "Vonix Hair"} — Vonix Hair` : "Página não encontrada — Vonix Hair";
    const description = DESCRIPTIONS[loaderData?.slug ?? ""] ?? "Informações da loja Vonix Hair, cosméticos capilares profissionais.";
    return {
      meta: [
        { title: t },
        { name: "description", content: description },
        { property: "og:title", content: t },
        { property: "og:description", content: description },
        { property: "og:image", content: `${SITE_URL}/og-vonix.jpg` },
        { name: "twitter:image", content: `${SITE_URL}/og-vonix.jpg` },
        ...(loaderData ? [{ property: "og:url", content: `${SITE_URL}/${loaderData.slug}` }] : []),
      ],
      links: loaderData ? [{ rel: "canonical", href: `${SITE_URL}/${loaderData.slug}` }] : [],
    };
  },
  component: InfoPage,
});

function InfoPage() {
  const { text } = Route.useLoaderData();
  return (
    <Shell>
      <Page>
        <Md text={text} />
      </Page>
    </Shell>
  );
}
