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
    background: "bg-[#f3ddd1]",
  },
  {
    id: "02",
    tag: "BELEZA CAPILAR",
    title: "Afinidade de verdade",
    description:
      "O universo da Vonix Hair é feito de cuidados com os fios. Conte como esse assunto aparece na sua rotina ou nas suas criações.",
    image: "/images/products/progressiva-fio-de-luz.jpg",
    alt: "Progressiva Fio de Luz da Vonix Hair, produto oficial da marca",
    background: "bg-[#efe4df]",
  },
  {
    id: "03",
    tag: "CRIAÇÃO",
    title: "Ideias com personalidade",
    description:
      "Rotinas, fotos, resenhas sinceras e vídeos são jeitos de mostrar sua criatividade. A qualidade da ideia vale mais do que uma fórmula pronta.",
    image: "/images/products/mascara-reparacao-nutri-repair.jpg",
    alt: "Máscara de Reparação Nutri Repair da Vonix Hair, produto oficial da marca",
    background: "bg-[#ead7cc]",
  },
  {
    id: "04",
    tag: "CONEXÃO",
    title: "Seu jeito de comunicar",
    description:
      "A seleção é uma oportunidade de apresentar seu perfil para análise. O cadastro não gera parceria, vantagens ou contrato automaticamente.",
    image: "/images/products/botox-vonix.jpg",
    alt: "Botox Vonix, produto oficial da Vonix Hair",
    background: "bg-[#eee4dd]",
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
      "Pessoas interessadas em criar conteúdo e apresentar seus perfis sociais à Vonix Hair. A seleção é feita pela equipe e não existe aprovação automática.",
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
      "O envio da candidatura não garante produtos gratuitos, cupons ativos, remuneração, comissão ou uma parceria. Qualquer condição comercial depende de aprovação, comunicação oficial e eventual acordo específico.",
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
        "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.25em] " +
        (light ? "text-[#e8bfad]" : "text-[#94555f]")
      }
    >
      <span className={light ? "h-px w-7 bg-[#e7ad9e]" : "h-px w-7 bg-[#a96c77]"} />
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
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={"block h-full w-full object-contain " + className}
    />
  );
}

export function AffiliateLandingIntro({
  recruitmentStatus,
}: {
  recruitmentStatus: RecruitmentStatus;
}) {
  const isOpen = recruitmentStatus === "open";

  return (
    <div data-testid="vonix-affiliate-editorial" className="overflow-hidden">
      <section
        data-testid="vonix-affiliate-hero"
        aria-labelledby="vonix-affiliate-title"
        className="relative isolate overflow-hidden bg-[#f9f0e9] px-5 pb-16 pt-9 sm:pb-24 sm:pt-20"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-44 h-[37rem] w-[37rem] rounded-full bg-[#edcdbf]/45 blur-[95px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -left-48 h-[33rem] w-[33rem] rounded-full bg-[#c8a5a3]/25 blur-[90px]"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.97fr_1.03fr] lg:gap-8">
          <div className="relative z-10 max-w-[43rem]">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#d9b9ad] bg-white/70 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.17em] text-[#804755] sm:text-xs">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Vonix Hair · Programa de afiliadas
            </div>
            <h1
              id="vonix-affiliate-title"
              className="font-display text-[clamp(3.45rem,7.4vw,6.6rem)] leading-[.99] tracking-[-.045em] text-[#311923]"
            >
              Seu jeito de <span className="italic text-[#a56470]">criar.</span>
              <span className="mt-2 block">Nossa paixão por cabelos.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-[1.8] text-[#6c5057] sm:text-lg">
              Sua criatividade tem uma história. Queremos conhecer pessoas que amam o universo dos
              cuidados capilares e têm algo verdadeiro para compartilhar. Apresente seu perfil à
              <strong className="font-semibold text-[#3b2730]"> Vonix Hair</strong>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#inscricao"
                className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-[#5b303f] px-7 py-3.5 text-sm font-bold text-white shadow-[0_16px_32px_rgba(91,48,63,.2)] transition hover:-translate-y-0.5 hover:bg-[#774252] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5b303f]"
              >
                {isOpen ? "Enviar minha candidatura" : "Conhecer a inscrição"}
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex min-h-12 items-center gap-2 px-3 py-3 text-sm font-semibold text-[#75444f] underline decoration-[#c99a9a] underline-offset-4 hover:text-[#4d2935]"
              >
                Entenda a seleção <ArrowDownRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2.5" aria-label="Informações da candidatura">
              {["Inscrição gratuita", "A partir de 18 anos", "Sem portfólio obrigatório"].map(
                (text) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-2 rounded-full border border-[#ead5cc] bg-white/70 px-3.5 py-2 text-[11px] font-semibold text-[#704e57] sm:text-xs"
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#995d67]" />
                    {text}
                  </span>
                ),
              )}
            </div>
            <p className="mt-5 max-w-md text-xs leading-relaxed text-[#80666a]">
              A candidatura não garante aprovação, benefícios ou vínculo comercial.
            </p>
          </div>

          <div
            className="relative mx-auto h-[28rem] w-full max-w-[34rem] sm:h-[35rem] lg:h-[39rem]"
            aria-label="Produtos originais da Vonix Hair"
          >
            <div
              aria-hidden="true"
              className="absolute inset-[12%_8%_8%_12%] rotate-[-8deg] rounded-[46%_54%_40%_60%] bg-[#e6c7bf]"
            />
            <div className="absolute right-[2%] top-[2%] h-[67%] w-[67%] rotate-[5deg] overflow-hidden rounded-[42%_42%_22%_22%] border-[7px] border-[#fff9f4] bg-white shadow-[0_28px_72px_rgba(90,48,63,.17)] sm:border-[10px]">
              <ProductImage
                priority
                src="/images/products/kit-banana-e-mel.jpg"
                alt="Kit Banana e Mel da Vonix Hair, em destaque na apresentação da marca"
                className="p-3 sm:p-5"
              />
            </div>
            <div className="absolute bottom-[1%] left-[4%] h-[56%] w-[49%] rotate-[-9deg] overflow-hidden rounded-[2rem] border-[7px] border-[#fff9f4] bg-white shadow-[0_22px_60px_rgba(90,48,63,.22)] sm:border-[10px]">
              <ProductImage
                priority
                src="/images/products/botox-vonix.jpg"
                alt="Embalagem original do Botox Vonix Hair"
                className="p-3 sm:p-5"
              />
            </div>
            <div className="absolute bottom-[7%] right-[1%] h-[35%] w-[38%] rotate-[9deg] overflow-hidden rounded-[1.6rem] border-[6px] border-[#fff9f4] bg-white shadow-[0_18px_48px_rgba(90,48,63,.15)] sm:border-[8px]">
              <ProductImage
                src="/images/products/mascara-reparacao-nutri-repair.jpg"
                alt="Máscara Nutri Repair da Vonix Hair"
                className="p-2 sm:p-4"
              />
            </div>
            <div className="absolute left-[2%] top-[2%] z-10 rotate-[-7deg] rounded-2xl border border-[#e9d5c9] bg-[#fff9f4] px-4 py-3 text-center shadow-xl sm:left-[6%] sm:px-5">
              <span className="block font-display text-lg italic text-[#854c5a] sm:text-xl">
                criação com
              </span>
              <span className="block font-display text-2xl text-[#3b202a] sm:text-3xl">
                identidade
              </span>
            </div>
            <div className="absolute bottom-[2%] right-[3%] z-10 rounded-full bg-[#602f40] px-4 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-white shadow-lg sm:text-xs">
              100% universo Vonix Hair
            </div>
          </div>
        </div>
      </section>

      <div
        aria-label="Universo criativo Vonix Hair"
        className="overflow-hidden bg-[#5b303f] py-4 text-[#f9e7da]"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 text-[10px] font-extrabold uppercase tracking-[.2em] sm:gap-x-9 sm:text-xs">
          <span>Beleza capilar</span>
          <span aria-hidden="true" className="text-[#ddaa9f]">
            ✦
          </span>
          <span>Conteúdo original</span>
          <span aria-hidden="true" className="text-[#ddaa9f]">
            ✦
          </span>
          <span>Histórias reais</span>
          <span aria-hidden="true" className="text-[#ddaa9f]">
            ✦
          </span>
          <span>Vonix Hair</span>
        </div>
      </div>

      <section id="criterios" className="scroll-mt-24 bg-[#fffaf6] px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-end gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <Eyebrow>O universo Vonix Hair</Eyebrow>
              <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.12] tracking-tight text-[#352029] sm:text-5xl lg:text-6xl">
                Não procuramos uma fórmula.{" "}
                <span className="italic text-[#a36b73]">Queremos conhecer você.</span>
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-[1.9] text-[#775e62] sm:text-base lg:pb-2">
              Cada criadora tem uma forma própria de falar sobre beleza. Esses são alguns dos temas
              que ajudam a equipe a conhecer seu perfil — não uma lista de vantagens garantidas ou
              requisitos de aprovação automática.
            </p>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[.15em] text-[#98747b] sm:hidden">
            Deslize para conhecer os temas <span aria-hidden="true">→</span>
          </p>
          <div
            role="region"
            aria-label="Temas da seleção Vonix Hair; deslize horizontalmente em telas pequenas"
            tabIndex={0}
            className="-mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 scroll-px-5 focus-visible:outline-2 focus-visible:outline-[#825363] sm:mx-0 sm:mt-12 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
          >
            {experiences.map((item) => (
              <article
                key={item.id}
                className="group flex min-w-[78vw] max-w-[21rem] snap-start flex-col overflow-hidden rounded-[1.75rem] border border-[#e9d9d0] bg-white shadow-[0_14px_35px_rgba(66,32,42,.055)] sm:min-w-0 sm:max-w-none"
              >
                <div className={"relative aspect-[4/3] overflow-hidden " + item.background}>
                  <ProductImage
                    src={item.image}
                    alt={item.alt}
                    className="p-5 transition duration-500 group-hover:scale-[1.055]"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold tracking-widest text-[#734652]">
                    {item.id}
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-5 pb-6 pt-6 sm:px-6">
                  <p className="text-[10px] font-extrabold tracking-[.19em] text-[#a37379]">
                    {item.tag}
                  </p>
                  <h3 className="mt-3 font-display text-2xl leading-tight text-[#38232c]">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-[1.75] text-[#766066]">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-[#967b80]">
            Imagens dos próprios produtos Vonix Hair, utilizadas como apresentação de catálogo. Não
            representam candidatas, depoimentos ou colaborações realizadas.
          </p>
        </div>
      </section>

      <section
        id="como-funciona"
        className="scroll-mt-24 relative overflow-hidden bg-[#3c212c] px-5 py-20 text-[#fffbf8] sm:py-28"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 top-0 h-96 w-96 rounded-full bg-[#a86b79]/20 blur-[90px]"
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
            <div>
              <Eyebrow light>Como funciona</Eyebrow>
              <h2 className="mt-5 max-w-xl font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
                Três momentos.{" "}
                <span className="italic text-[#e7b6ab]">Seu primeiro passo é aqui.</span>
              </h2>
            </div>
            <p className="max-w-lg text-base leading-[1.85] text-[#e7cfd1]">
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
              <article
                key={number}
                className="relative rounded-[1.75rem] border border-white/15 bg-white/[.07] p-7 sm:p-9"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-5xl text-[#e8b6a8]">{number}</span>
                  <Icon aria-hidden="true" className="h-7 w-7 text-[#deb4a7]" />
                </div>
                <h3 className="mt-9 font-display text-2xl">{title}</h3>
                <p className="mt-4 text-sm leading-[1.8] text-[#e7cfd1]">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-5 rounded-[1.5rem] border border-[#c9918e]/40 bg-[#6d3e4c]/50 px-6 py-6 sm:px-9">
            <p className="max-w-2xl text-sm leading-[1.75] text-[#fff0e8]">
              <strong>Inscrições em preparação?</strong> Você pode visualizar o formulário simples
              em uma prévia segura, sem enviar ou armazenar seus dados.
            </p>
            <a
              href="#inscricao"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#fff6ef] px-5 py-2.5 text-sm font-bold text-[#5e3542] transition hover:bg-white"
            >
              Ver disponibilidade <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#f8efe8] px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <Eyebrow>Seu perfil, sua identidade</Eyebrow>
            <h2 className="mt-5 font-display text-4xl leading-tight tracking-tight text-[#38242c] sm:text-5xl lg:text-6xl">
              Dois jeitos de criar.{" "}
              <span className="italic text-[#a16d74]">Infinitas ideias para contar.</span>
            </h2>
            <p className="mt-6 text-base leading-[1.8] text-[#765c63]">
              Não é preciso se encaixar em um único formato. Abaixo estão perfis possíveis de
              pessoas que podem apresentar sua candidatura — não modalidades de parceria previamente
              contratadas.
            </p>
          </div>
          <div className="mt-11 grid gap-5 lg:grid-cols-2">
            <article className="relative flex min-h-[23rem] flex-col overflow-hidden rounded-[2.25rem] bg-[#efd8d4] p-7 sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full border-[38px] border-white/30"
              />
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#70444e]">
                  <Heart aria-hidden="true" className="h-3.5 w-3.5" /> Possibilidade 01
                </span>
                <h3 className="mt-10 max-w-sm font-display text-3xl leading-tight text-[#4b2733] sm:text-4xl">
                  Quero compartilhar minha rotina.
                </h3>
                <p className="mt-5 max-w-md text-sm leading-[1.8] text-[#71545c]">
                  Você gosta de conversar com sua audiência sobre cabelo, beleza e autocuidado. Quer
                  mostrar suas experiências com uma linguagem própria, sem precisar de um portfólio
                  profissional para se apresentar.
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {["Conteúdo autoral", "Rotina de beleza", "Comunidade"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#d6adae] px-3 py-1.5 text-xs text-[#6f4350]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <article className="relative flex min-h-[23rem] flex-col overflow-hidden rounded-[2.25rem] bg-[#e9ddd3] p-7 sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[38px] border-white/30"
              />
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#70444e]">
                  <Camera aria-hidden="true" className="h-3.5 w-3.5" /> Possibilidade 02
                </span>
                <h3 className="mt-10 max-w-sm font-display text-3xl leading-tight text-[#4b2733] sm:text-4xl">
                  Quero explorar conteúdos UGC.
                </h3>
                <p className="mt-5 max-w-md text-sm leading-[1.8] text-[#71545c]">
                  Você se interessa por composição, edição, vídeos ou fotos de produtos. Seu perfil
                  pode mostrar habilidades criativas, mesmo sem experiências anteriores com marcas.
                </p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {["Vídeos e fotos", "Composição", "Portfólio pessoal"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#d5c0b5] px-3 py-1.5 text-xs text-[#6f4350]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="formatos" className="scroll-mt-24 bg-[#fffaf6] px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <Eyebrow>Inspiração capilar</Eyebrow>
              <h2 className="mt-5 font-display text-4xl leading-tight text-[#352129] sm:text-5xl lg:text-6xl">
                Crie do <span className="italic text-[#a16d74]">seu jeito.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-[1.8] text-[#765b62]">
                O universo dos cabelos rende muitas ideias. Estes são exemplos de formatos que você
                pode explorar com produtos que conhece, com sinceridade e atenção às orientações de
                uso.
              </p>
            </div>
            <span className="rounded-full border border-[#e7d6ce] bg-[#fff8f4] px-4 py-2 text-xs font-semibold text-[#8e626c]">
              Exemplos de formatos · não são posts de creators
            </span>
          </div>

          <div
            role="region"
            aria-label="Formatos criativos ilustrados com produtos oficiais Vonix Hair"
            tabIndex={0}
            className="-mx-5 mt-11 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 scroll-px-5 focus-visible:outline-2 focus-visible:outline-[#825363] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
            data-testid="vonix-original-products"
          >
            {creativeIdeas.map((idea) => (
              <article
                key={idea.number}
                className="group min-w-[76vw] max-w-[20rem] snap-start overflow-hidden rounded-[1.7rem] border border-[#ebded5] bg-[#f8f0e9] shadow-sm sm:min-w-0 sm:max-w-none"
              >
                <div className="relative aspect-[.95] overflow-hidden bg-white">
                  <ProductImage
                    src={idea.image}
                    alt={idea.alt}
                    className="p-5 transition duration-500 group-hover:scale-[1.06]"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-[#603744] px-3 py-1 text-xs font-bold text-white">
                    {idea.number}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl text-[#39242e]">{idea.name}</h3>
                  <p className="mt-2 text-sm leading-[1.75] text-[#786167]">{idea.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-11 flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-[#ead5ca] bg-[#f9eee7] p-7 sm:flex-row sm:items-center sm:p-10">
            <div className="flex items-start gap-4">
              <PenLine aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[#a26872]" />
              <div>
                <h3 className="font-display text-2xl text-[#442834]">
                  Não existe um roteiro único para ter sua identidade.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-[1.8] text-[#735861]">
                  Conteúdo verdadeiro significa mostrar a própria experiência, sem inventar
                  resultados ou apresentar publicidade como opinião independente.
                </p>
              </div>
            </div>
            <a
              href="#inscricao"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#693a49] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#834b5b]"
            >
              Conhecer a candidatura <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#5c3444] px-5 py-16 text-center text-[#fff6ef] sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-36 h-80 w-80 rounded-full bg-[#d19b95]/20 blur-[70px]"
        />
        <div className="relative mx-auto max-w-4xl">
          <Sparkles aria-hidden="true" className="mx-auto h-7 w-7 text-[#ebc0b1]" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[.22em] text-[#efd0c1]">
            Seu próximo passo
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            A Vonix Hair quer conhecer <span className="italic text-[#efc3b3]">sua história.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-[1.9] text-[#f0dcd8] sm:text-base">
            Veja o status das inscrições, conheça o formulário e apresente sua candidatura quando o
            período de recebimento estiver aberto. Sem cobrança para se inscrever e sem promessas de
            aprovação.
          </p>
          <a
            href="#inscricao"
            className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#fff6ed] px-7 py-3 text-sm font-bold text-[#5a3442] hover:bg-white"
          >
            {isOpen ? "Preencher candidatura" : "Visualizar formulário"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

export function AffiliateLandingFAQ() {
  return (
    <section id="duvidas" className="scroll-mt-24 bg-[#f9f0e9] px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
        <div>
          <Eyebrow>Perguntas frequentes</Eyebrow>
          <h2 className="mt-5 font-display text-4xl leading-tight text-[#3a242d] sm:text-5xl">
            Tudo mais claro <span className="italic text-[#a66d78]">desde o começo.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-[1.85] text-[#796168]">
            A página explica o processo de candidatura. Benefícios comerciais, contratação e
            condições de parceria, se houver, são tratados separadamente pela Vonix Hair.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#e8d7cf] bg-white/70 p-5">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#8b5b64]" />
            <p className="text-xs leading-[1.8] text-[#71595f]">
              Os dados do formulário são destinados à análise da candidatura. Consulte também a
              Política de Privacidade no formulário antes de aceitar os termos.
            </p>
          </div>
        </div>

        <div className="space-y-3" data-testid="vonix-affiliate-faq">
          {questions.map(({ question, answer }, i) => (
            <details
              key={question}
              className="group rounded-[1.4rem] border border-[#e6d4ca] bg-[#fffaf7] px-5 py-1 shadow-[0_8px_24px_rgba(66,32,42,.035)] open:border-[#cba6a0] sm:px-7"
            >
              <summary className="flex min-h-[4.6rem] cursor-pointer list-none items-center gap-4 py-4 text-left font-semibold text-[#452d37] marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="shrink-0 font-display text-xl text-[#a36d75]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-sm leading-relaxed sm:text-base">{question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-[#976773] transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-[#ecdcd3] pb-6 pt-4 text-sm leading-[1.85] text-[#725b62]">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl rounded-[2rem] bg-[#3d2632] px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#e4bcaf]">
          Vonix Hair · Afiliadas
        </p>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl leading-tight sm:text-5xl">
          Sua criatividade merece ser conhecida.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-[1.85] text-[#ead6d6]">
          Preencha o formulário simples e acompanhe a disponibilidade oficial da seleção.
        </p>
        <a
          href="#inscricao"
          className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#f5e3d6] px-7 py-3 text-sm font-bold text-[#51303d] transition hover:bg-white"
        >
          Ir para a inscrição <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
