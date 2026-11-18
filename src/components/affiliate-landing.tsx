import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Heart,
  MessageCircleHeart,
  PenLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AffiliateCreatorPaths } from "@/components/affiliate-creator-paths";
import {
  AffiliateCreatorOpportunity,
  AffiliateEarningsSimulator,
} from "@/components/affiliate-creator-opportunity";

type RecruitmentStatus = "loading" | "open" | "limited" | "closed";

const experiences = [
  {
    id: "01",
    tag: "IDENTIDADE",
    title: "Sua história importa",
    description:
      "Queremos conhecer sua linguagem, seu público e o que torna seu conteúdo diferente. Não precisa reproduzir o estilo de outra pessoa.",
    image: "/images/products/kit-banana-e-mel.jpg",
    alt: "Kit Banana e Mel da Vonix Hair, produto oficial da marca",
    background: "bg-card",
  },
  {
    id: "02",
    tag: "BELEZA CAPILAR",
    title: "Afinidade de verdade",
    description:
      "O universo da Vonix Hair é feito de cuidados com os fios. Conte como esse assunto aparece na sua rotina ou nas suas criações.",
    image: "/images/products/progressiva-fio-de-luz.jpg",
    alt: "Progressiva Fio de Luz da Vonix Hair, produto oficial da marca",
    background: "bg-card",
  },
  {
    id: "03",
    tag: "CRIAÇÃO",
    title: "Ideias com personalidade",
    description:
      "Rotinas, fotos, resenhas sinceras e vídeos são jeitos de mostrar sua criatividade. A qualidade da ideia vale mais do que uma fórmula pronta.",
    image: "/images/products/mascara-reparacao-nutri-repair.jpg",
    alt: "Máscara de Reparação Nutri Repair da Vonix Hair, produto oficial da marca",
    background: "bg-card",
  },
  {
    id: "04",
    tag: "CONEXÃO",
    title: "Seu jeito de comunicar",
    description:
      "A seleção é uma oportunidade de apresentar seu perfil para análise. O cadastro não gera parceria, vantagens ou contrato automaticamente.",
    image: "/images/products/botox-vonix.jpg",
    alt: "Botox Vonix, produto oficial da Vonix Hair",
    background: "bg-card",
  },
] as const;

const creativeIdeas = [
  {
    number: "01",
    name: "Unboxing",
    text: "Apresente uma experiência real com um produto que você conhece.",
    image: "/images/products/kit-cronograma-capilar.jpg",
    alt: "Kit Cronograma Capilar Vonix Hair",
  },
  {
    number: "02",
    name: "Rotina capilar",
    text: "Mostre como o autocuidado entra na sua rotina, sem prometer resultados.",
    image: "/images/products/kit-cachos.jpg",
    alt: "Kit Cachos Vonix Hair",
  },
  {
    number: "03",
    name: "Resenha sincera",
    text: "Explique sua experiência e suas impressões com transparência.",
    image: "/images/products/mascara-reparacao-nutri-repair.jpg",
    alt: "Máscara de Reparação Nutri Repair Vonix Hair",
  },
  {
    number: "04",
    name: "Foto de produto",
    text: "Explore ângulos, cenários e composições que tenham a sua identidade.",
    image: "/images/products/botox-vonix.jpg",
    alt: "Botox Vonix Hair",
  },
] as const;

const questions = [
  {
    question: "Quem pode apresentar uma candidatura?",
    answer:
      "Pessoas interessadas em criar conteúdo e apresentar seus perfis sociais à Vonix Hair. É necessário ter 18 anos ou mais. A seleção é feita pela equipe e não existe aprovação automática.",
  },
  {
    question: "Preciso ter portfólio ou muitos seguidores?",
    answer:
      "Não exigimos um portfólio para preencher a inscrição, e o formulário contempla diferentes tamanhos de audiência. A avaliação considera as informações fornecidas e a afinidade com o universo da Vonix Hair.",
  },
  {
    question: "Preciso comprar algum produto para me inscrever?",
    answer:
      "Não. A candidatura por este formulário é gratuita e não exige a compra de um produto. Caso uma parceria seja proposta posteriormente, suas condições serão apresentadas de forma separada antes de qualquer compromisso.",
  },
  {
    question: "Vou receber produtos, cupom, pagamento ou comissão?",
    answer:
      "O envio da candidatura não garante produtos gratuitos, cupons ativos, remuneração, comissão ou uma parceria. Qualquer condição comercial depende de aprovação, comunicação oficial e eventual acordo específico. Para afiliadas aprovadas: você vende pelo preço do site, com comissão de 8% sobre cada venda confirmada, mais R$ 500 a cada R$ 10 mil vendidos, e pode virar supervisora ao bater as metas, ganhando também, em média, 4% sobre o valor bruto vendido pela sua equipe. Bônus e supervisão dependem de elegibilidade, metas e avaliação da equipe; não são garantidos.",
  },
  {
    question: "Como funciona a avaliação?",
    answer:
      "Você informa nome, telefone, endereço completo e Instagram com número de seguidores em um único formulário. TikTok e seus seguidores são opcionais. A equipe poderá entrar em contato pelo telefone informado. Não há prazo de resposta garantido.",
  },
  {
    question: "Já posso enviar meu cadastro?",
    answer:
      "A disponibilidade real aparece na seção de inscrição. Quando o cadastro estiver em preparação, você poderá conhecer apenas a prévia interativa. A prévia não envia nem armazena candidaturas.",
  },
] as const;

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={
        "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-normal " +
        (light ? "text-primary-foreground" : "text-primary")
      }
    >
      <span className={light ? "h-px w-7 bg-primary-foreground" : "h-px w-7 bg-primary"} />
      {children}
    </p>
  );
}

function ProductImage({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <picture className={"block h-full w-full " + className}>
      <source srcSet={src.replace(/\.jpg$/, ".webp")} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={768}
        height={768}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className="block h-full w-full object-contain"
      />
    </picture>
  );
}

export function AffiliateLandingIntro({
  recruitmentStatus,
}: {
  recruitmentStatus: RecruitmentStatus;
}) {
  const isOpen = recruitmentStatus === "open";

  return (
    <div data-testid="vonix-affiliate-editorial" className="min-w-0">
      <section
        data-testid="vonix-affiliate-hero"
        aria-labelledby="vonix-affiliate-title"
        className="relative isolate min-h-[650px] bg-card px-5 py-9 sm:min-h-[41rem] sm:py-14"
      >
        <picture className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 block h-[230px] bg-card sm:inset-0 sm:h-full">
          <source srcSet="/images/products/kit-banana-e-mel.webp" type="image/webp" />
          <img
            src="/images/products/kit-banana-e-mel.jpg"
            alt="Kit Banana e Mel original comercializado na loja Vonix Hair"
            width={768}
            height={768}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="h-full w-full object-contain object-right opacity-30 sm:opacity-20 lg:opacity-100"
          />
        </picture>
        <div className="mx-auto max-w-7xl">
          <div className="max-w-xl lg:max-w-[36rem]">
            <p className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-primary">
              <Sparkles aria-hidden="true" className="size-4" /> Inscrição gratuita · seleção
              individual
            </p>
            <p className="mt-7 text-sm font-semibold text-primary">
              Vonix Hair · Programa de afiliadas
            </p>
            <h1
              id="vonix-affiliate-title"
              className="mt-3 font-display text-4xl leading-tight sm:text-5xl lg:text-5xl"
            >
              Seu jeito de <span className="italic text-primary">criar.</span>
              <span className="block">Nossa paixão por cabelos.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground">
              Você tem uma história para compartilhar. Apresente seu perfil à Vonix Hair e explore
              uma possível parceria no universo dos cuidados capilares.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="h-auto min-h-12 whitespace-normal px-6 py-3">
                <a href="#inscricao">
                  {isOpen ? "Enviar minha candidatura" : "Conhecer a inscrição"}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </Button>
              <Button asChild variant="link" className="h-auto min-h-11 whitespace-normal">
                <a href="#ganhos">
                  Conhecer as condições <ArrowDownRight aria-hidden="true" />
                </a>
              </Button>
            </div>
            <ul
              className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground"
              aria-label="Informações da candidatura"
            >
              {["Inscrição gratuita", "A partir de 18 anos", "Sem portfólio obrigatório"].map(
                (text) => (
                  <li key={text} className="inline-flex items-center gap-2">
                    <Check aria-hidden="true" className="size-4 text-primary" />
                    {text}
                  </li>
                ),
              )}
            </ul>
            <div
              role="status"
              className="mt-5 inline-flex max-w-lg flex-wrap items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2 text-xs font-semibold text-foreground"
            >
              <span
                aria-hidden="true"
                className={
                  "h-2 w-2 shrink-0 rounded-full " +
                  (isOpen
                    ? "bg-emerald-600"
                    : recruitmentStatus === "loading"
                      ? "bg-amber-600"
                      : "bg-primary")
                }
              />
              {isOpen
                ? "Candidaturas abertas para análise"
                : recruitmentStatus === "loading"
                  ? "Consultando disponibilidade de inscrição"
                  : recruitmentStatus === "limited"
                    ? "Inscrição temporariamente limitada nesta conexão"
                    : "Conheça o formulário enquanto as inscrições estão em preparação"}
            </div>
            <p className="mt-4 max-w-lg text-xs leading-relaxed text-muted-foreground">
              A candidatura não garante aprovação, benefícios ou vínculo comercial. Não exige
              estoque nem compra de produtos para se candidatar.
            </p>
          </div>
        </div>
      </section>

      <div
        aria-label="Universo criativo Vonix Hair"
        className="overflow-hidden bg-primary py-4 text-primary-foreground"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 text-[10px] font-extrabold uppercase tracking-normal sm:gap-x-9 sm:text-xs">
          <span>Beleza capilar</span>
          <span aria-hidden="true" className="text-primary-foreground">
            ✦
          </span>
          <span>Conteúdo original</span>
          <span aria-hidden="true" className="text-primary-foreground">
            ✦
          </span>
          <span>Histórias reais</span>
          <span aria-hidden="true" className="text-primary-foreground">
            ✦
          </span>
          <span>Vonix Hair</span>
        </div>
      </div>

      <section
        id="ganhos"
        data-testid="vonix-affiliate-earnings"
        aria-labelledby="vonix-affiliate-earnings-title"
        className="scroll-mt-24 bg-card px-5 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <Eyebrow>Quanto você ganha</Eyebrow>
            <h2
              id="vonix-affiliate-earnings-title"
              className="mt-5 font-display text-4xl leading-tight tracking-normal text-foreground sm:text-5xl"
            >
              Para afiliadas aprovadas.{" "}
              <span className="italic text-primary">Condições claras, desde o começo.</span>
            </h2>
            <p className="mt-5 text-base leading-[1.8] text-muted-foreground">
              Após aprovação e definição das condições, você divulga pelo seu link. A Vonix Hair
              cuida da venda, entrega e atendimento. A candidatura é gratuita, sem estoque ou compra
              obrigatória para se candidatar.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                big: "8%",
                title: "Comissão de 8% em cada venda",
                text: "Sobre vendas confirmadas e pagas. A comissão depende de aprovação e das condições aplicáveis à parceria.",
              },
              {
                big: "+ R$ 500",
                title: "Bônus a cada R$ 10 mil vendidos",
                text: "Bônus anunciado de R$ 500 por cada R$ 10.000 vendidos, condicionado às regras de elegibilidade. Não é garantido pela candidatura.",
              },
              {
                big: "Supervisora",
                title: "Cresça para supervisora",
                text: "Possibilidade de se tornar supervisora conforme metas e avaliação da equipe. A condição anunciada inclui, em média, 4% sobre o valor bruto vendido pela equipe, além das próprias comissões. Não há promoção automática.",
              },
            ].map(({ big, title, text }) => (
              <article
                key={title}
                className="min-w-0 rounded-lg border border-border bg-background p-6 shadow-sm"
              >
                <p className="font-display text-3xl text-primary sm:text-4xl">{big}</p>
                <h3 className="mt-5 font-display text-2xl text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-[1.75] text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Valores sobre vendas confirmadas e pagas. As metas da supervisora são combinadas pela
            equipe com cada afiliada aprovada. Bônus e supervisão dependem de elegibilidade.
          </p>
          <AffiliateEarningsSimulator />
        </div>
      </section>

      <section id="criterios" className="scroll-mt-24 bg-card px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <Eyebrow>O universo Vonix Hair</Eyebrow>
              <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.12] tracking-normal text-foreground sm:text-5xl lg:text-5xl">
                Não procuramos uma fórmula.{" "}
                <span className="italic text-primary">Queremos conhecer você.</span>
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-[1.9] text-muted-foreground sm:text-base lg:pb-2">
              Cada criadora tem uma forma própria de falar sobre beleza. Esses são alguns dos temas
              que ajudam a equipe a conhecer seu perfil — não uma lista de vantagens garantidas ou
              requisitos de aprovação automática.
            </p>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-normal text-muted-foreground sm:hidden">
            Deslize para conhecer os temas <span aria-hidden="true">→</span>
          </p>
          <div
            role="region"
            aria-label="Temas da seleção Vonix Hair; deslize horizontalmente em telas pequenas"
            tabIndex={0}
            className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 scroll-px-5 focus-visible:outline-2 focus-visible:outline-ring sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
          >
            {experiences.map((item) => (
              <article
                key={item.id}
                className="group flex min-w-[78vw] max-w-[21rem] snap-start flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:min-w-0 sm:max-w-none"
              >
                <div className={"relative aspect-[4/3] overflow-hidden " + item.background}>
                  <ProductImage
                    src={item.image}
                    alt={item.alt}
                    className="p-5 transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
                  />
                  <span className="absolute left-4 top-4 rounded-full border border-border bg-background/95 px-3 py-1 text-[10px] font-bold tracking-wide text-primary">
                    {item.id}
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-5 pb-6 pt-6 sm:px-6">
                  <p className="text-[10px] font-extrabold tracking-normal text-muted-foreground">
                    {item.tag}
                  </p>
                  <h3 className="mt-3 font-display text-2xl leading-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-[1.75] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            Imagens dos próprios produtos Vonix Hair, utilizadas como apresentação de catálogo. Não
            representam candidatas, depoimentos ou colaborações realizadas.
          </p>
        </div>
      </section>

      <section
        id="como-funciona"
        className="scroll-mt-24 relative overflow-hidden bg-primary px-5 py-20 text-primary-foreground sm:py-28"
      >
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
            <div>
              <Eyebrow light>Como funciona</Eyebrow>
              <h2 className="mt-5 max-w-xl font-display text-4xl leading-tight sm:text-5xl lg:text-5xl">
                Três momentos.{" "}
                <span className="italic text-primary-foreground">Seu primeiro passo é aqui.</span>
              </h2>
            </div>
            <p className="max-w-lg text-base leading-[1.85] text-primary-foreground">
              A seleção começa pelo cadastro, passa por uma análise da equipe e pode evoluir para
              uma conversa sobre possibilidades. Não existe aprovação instantânea nem condição
              comercial automática.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Apresente seu perfil",
                text: "Preencha seus dados e Instagram com seguidores. TikTok é opcional.",
                Icon: ClipboardList,
              },
              {
                number: "02",
                title: "Análise individual",
                text: "Quando as inscrições estiverem abertas, as informações serão avaliadas pela equipe responsável pela seleção.",
                Icon: UsersRound,
              },
              {
                number: "03",
                title: "Próximos passos",
                text: "Se houver avanço, a equipe poderá entrar em contato pelos canais informados e apresentar as condições aplicáveis.",
                Icon: MessageCircleHeart,
              },
            ].map(({ number, title, text, Icon }) => (
              <article key={number} className="relative border-t border-border py-7 sm:py-9">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-5xl text-primary-foreground">{number}</span>
                  <Icon aria-hidden="true" className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="mt-9 font-display text-2xl">{title}</h3>
                <p className="mt-4 text-sm leading-[1.8] text-primary-foreground">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-border py-6">
            <p className="max-w-2xl text-sm leading-[1.75] text-primary-foreground">
              <strong>Inscrições em preparação?</strong> Você pode visualizar o formulário simples
              em uma prévia segura, sem enviar ou armazenar seus dados.
            </p>
            <Button asChild variant="link" className="h-auto min-h-11 max-w-full whitespace-normal">
              <a
                href="#inscricao"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-accent"
              >
                Ver disponibilidade <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <AffiliateCreatorPaths />

      <AffiliateCreatorOpportunity recruitmentOpen={isOpen} />

      <section id="formatos" className="scroll-mt-24 bg-card px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <Eyebrow>Inspiração capilar</Eyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight text-foreground sm:text-5xl lg:text-5xl">
                Crie do <span className="italic text-primary">seu jeito.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-[1.8] text-muted-foreground">
                O universo dos cabelos rende muitas ideias. Estes são exemplos de formatos que você
                pode explorar com produtos que conhece, com sinceridade e atenção às orientações de
                uso.
              </p>
            </div>
            <span className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
              Exemplos de formatos · não são posts de creators
            </span>
          </div>

          <div
            role="region"
            aria-label="Formatos criativos ilustrados com produtos oficiais Vonix Hair"
            tabIndex={0}
            className="-mx-5 mt-11 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 scroll-px-5 focus-visible:outline-2 focus-visible:outline-ring sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
            data-testid="vonix-original-products"
          >
            {creativeIdeas.map((idea) => (
              <article
                key={idea.number}
                className="group min-w-[76vw] max-w-[20rem] snap-start overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:min-w-0 sm:max-w-none"
              >
                <div className="relative aspect-[.95] overflow-hidden bg-card">
                  <ProductImage
                    src={idea.image}
                    alt={idea.alt}
                    className="p-5 motion-safe:transition motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-4 top-4 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                    {idea.number}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl text-foreground">{idea.name}</h3>
                  <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">{idea.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-11 flex flex-col items-start justify-between gap-6 rounded-lg border border-border bg-card p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="flex items-start gap-4">
              <PenLine aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-display text-2xl text-foreground">
                  Não existe um roteiro único para ter sua identidade.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-[1.8] text-muted-foreground">
                  Conteúdo verdadeiro significa mostrar a própria experiência, sem inventar
                  resultados ou apresentar publicidade como opinião independente.
                </p>
              </div>
            </div>
            <Button asChild variant="link" className="h-auto min-h-11 max-w-full whitespace-normal">
              <a
                href="#inscricao"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-accent"
              >
                Conhecer a candidatura <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AffiliateLandingFAQ() {
  return (
    <section id="duvidas" className="scroll-mt-24 bg-card px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
        <div>
          <Eyebrow>Perguntas frequentes</Eyebrow>
          <h2 className="mt-5 font-display text-4xl leading-tight text-foreground sm:text-5xl">
            Tudo mais claro <span className="italic text-primary">desde o começo.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-[1.85] text-muted-foreground">
            A página explica o processo de candidatura. Benefícios comerciais, contratação e
            condições de parceria, se houver, são tratados separadamente pela Vonix Hair.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-card p-5">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            />
            <p className="text-xs leading-[1.8] text-muted-foreground">
              Os dados do formulário são destinados à análise da candidatura. Consulte também a
              Política de Privacidade no formulário antes de aceitar os termos.
            </p>
          </div>
        </div>

        <div className="space-y-3" data-testid="vonix-affiliate-faq">
          {questions.map(({ question, answer }, i) => (
            <details
              key={question}
              className="group rounded-lg border border-border bg-card px-5 py-1 shadow-sm open:border-border sm:px-7"
            >
              <summary className="flex min-h-[4.6rem] cursor-pointer list-none items-center gap-4 py-4 text-left font-semibold text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="shrink-0 font-display text-xl text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-sm leading-relaxed sm:text-base">{question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-border pb-6 pt-4 text-sm leading-[1.85] text-muted-foreground">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl rounded-lg bg-primary px-6 py-12 text-center text-primary-foreground sm:px-10 sm:py-16">
        <p className="text-[11px] font-bold uppercase tracking-normal text-primary-foreground">
          Vonix Hair · Afiliadas
        </p>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl leading-tight sm:text-5xl">
          Sua criatividade merece ser conhecida.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-[1.85] text-primary-foreground">
          Preencha o formulário simples e acompanhe a disponibilidade oficial da seleção.
        </p>
        <Button asChild variant="link" className="h-auto min-h-11 max-w-full whitespace-normal">
          <a
            href="#inscricao"
            className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-card px-7 py-3 text-sm font-bold text-primary transition hover:bg-accent"
          >
            Ir para a inscrição <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}
