import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Heart, Sparkles, UsersRound } from "lucide-react";
import { Shell } from "@/components/site";
import { getAffiliateRecruitmentStatus } from "@/lib/affiliate-functions";
import { AffiliateWizard } from "@/components/affiliate-wizard";
import { SITE_URL } from "@/lib/store";

export const Route = createFileRoute("/seja-afiliada")({
  head: () => ({
    meta: [
      { title: "Seja um afiliado Vonix Hair | Inscrições" },
      {
        name: "description",
        content:
          "Conheça a inscrição para afiliadas Vonix Hair, o formulário de cinco etapas e como funciona a seleção de candidaturas.",
      },
      { property: "og:title", content: "Seja um afiliado Vonix Hair" },
      {
        property: "og:description",
        content: "Conheça o cadastro de cinco etapas para a seleção de afiliadas Vonix Hair.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/seja-afiliada" }],
  }),
  component: AffiliateApplicationPage,
});

export function AffiliateApplicationPage() {
  const [recruitment, setRecruitment] = useState<"loading" | "open" | "closed">("loading");
  const [preview, setPreview] = useState(false);
  const [previewHasDraft, setPreviewHasDraft] = useState(false);
  const [confirmPreviewExit, setConfirmPreviewExit] = useState(false);
  // Keep an already-started application mounted if the operator closes
  // recruitment while somebody is filling it in. It becomes read-only preview
  // mode, but never loses the unsent local draft or attempts to POST.
  const [liveFormStarted, setLiveFormStarted] = useState(false);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function refreshStatus() {
      const requestId = ++latestRequest;
      try {
        const { open } = await getAffiliateRecruitmentStatus();
        if (!active || requestId !== latestRequest) return;
        setRecruitment(open ? "open" : "closed");
        if (open) setLiveFormStarted(true);
      } catch {
        // Never assume availability while a status probe is unavailable.
        if (active && requestId === latestRequest) setRecruitment("closed");
      }
    }
    void refreshStatus();
    // Re-check availability after leaving a tab idle, without restarting
    // the five-stage form or reinterpreting a preview as a live application.
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      latestRequest += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const showWizard = preview || recruitment === "open" || liveFormStarted;
  const simulationOnly = preview || recruitment !== "open";

  function requestPreviewExit() {
    if (previewHasDraft) {
      setConfirmPreviewExit(true);
      return;
    }
    finishPreviewExit();
  }

  function finishPreviewExit() {
    setPreview(false);
    setPreviewHasDraft(false);
    setConfirmPreviewExit(false);
  }

  return (
    <Shell>
      <div className="bg-[#faf6f2] text-[#311f23]">
        <section className="relative overflow-hidden bg-[#30191e] px-5 py-16 text-[#fff8f0] sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-36 h-96 w-96 rounded-full bg-[#ad6669]/30 blur-[90px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-44 left-0 h-80 w-80 rounded-full bg-[#d1b18a]/20 blur-[95px]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e1bba4]/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-[#ecd2bd]">
                <Sparkles className="h-4 w-4" /> Programa de afiliados
              </div>
              <h1 className="max-w-2xl font-display text-5xl leading-[1.06] sm:text-6xl lg:text-7xl">
                SEJA UM <span className="italic text-[#e6bca7]">AFILIADO</span> VONIX HAIR
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#f4e5dd]">
                Seu amor por cabelos pode ir além de uma rotina de cuidados. Queremos conhecer
                criadoras que compartilham experiências reais e se identificam com o universo Vonix
                Hair.
              </p>
              <a
                href="#inscricao"
                className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#f5e0ce] px-7 py-3 text-sm font-bold text-[#361f25] transition hover:bg-white"
              >
                {recruitment === "open" ? "Quero me inscrever" : "Conhecer o programa"}{" "}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur-sm sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#f0cbaf]">
                Uma nova história começa aqui
              </p>
              <div className="mt-7 grid gap-7">
                <div className="flex gap-4">
                  <Heart className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Beleza com identidade</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      Um espaço para quem gosta de criar conteúdo de beleza e falar sobre cuidados
                      capilares.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <UsersRound className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Faça parte da comunidade</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      As inscrições selecionadas avançam para a próxima etapa e recebem as
                      orientações do programa.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Sparkles className="mt-1 h-7 w-7 shrink-0 text-[#e6bca7]" />
                  <div>
                    <h2 className="text-lg font-semibold">Conte sua história</h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#eddbd3]">
                      Nossa inscrição tem cinco etapas para você apresentar seu perfil e sua conexão
                      com a Vonix Hair. A equipe avaliará cada candidatura.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="inscricao" className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[.24em] text-[#9e565e]">
              {recruitment === "open" ? "Inscrições abertas" : "Programa de afiliados"}
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">
              Sua história começa em cinco etapas.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#765c5d] sm:text-base">
              Queremos conhecer sua trajetória, seu conteúdo e sua conexão com os produtos Vonix
              Hair. O cadastro não tem custo e não garante aprovação. Participação destinada a
              maiores de 18 anos.
            </p>
          </div>

          {!showWizard ? (
            <div
              role="status"
              className="mx-auto max-w-2xl rounded-[2rem] border border-[#e7d4cf] bg-white px-8 py-14 text-center shadow-[0_15px_70px_rgba(80,32,39,.08)]"
            >
              <Sparkles aria-hidden="true" className="mx-auto h-12 w-12 text-[#86535a]" />
              <h3 className="mt-5 font-display text-3xl sm:text-4xl">
                {recruitment === "loading"
                  ? "Verificando inscrições..."
                  : "Inscrições em preparação"}
              </h3>
              <p className="mt-4 leading-relaxed text-[#755b5e]">
                {recruitment === "loading"
                  ? "Estamos verificando a disponibilidade do cadastro."
                  : "O formulário de cinco etapas já está disponível para visualização, mas não recebe candidaturas enquanto a operação não estiver habilitada."}
              </p>
              {recruitment !== "loading" && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPreviewExit(false);
                    setPreview(true);
                  }}
                  className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#693440] px-7 py-3 text-sm font-bold text-white hover:bg-[#814d58]"
                >
                  Visualizar formulário (prévia) <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <div className="mt-5">
                <Link to="/" className="text-sm font-semibold text-[#83646a] underline">
                  Voltar à loja
                </Link>
              </div>
            </div>
          ) : (
            <>
              {simulationOnly && (
                <p
                  role="status"
                  className="mx-auto mb-5 max-w-3xl rounded-xl border border-[#eadbd6] bg-white p-4 text-center text-sm text-[#806268]"
                >
                  {preview
                    ? "Esta prévia nunca envia ou armazena candidaturas, mesmo se as inscrições forem abertas."
                    : "A disponibilidade mudou: este cadastro não recebe candidaturas agora. O rascunho permanece nesta aba, mas nenhum envio será realizado."}
                </p>
              )}
              {/* A preview must never turn into a live POST because status changed.
                  Switching explicitly to live starts a fresh form, not an old draft. */}
              <AffiliateWizard
                key={preview ? "preview" : "live"}
                preview={simulationOnly}
                onDraftChange={setPreviewHasDraft}
              />
              {preview && (
                <div className="mt-6 text-center">
                  {confirmPreviewExit ? (
                    <div
                      role="group"
                      aria-label="Confirmar saída da prévia"
                      className="mx-auto max-w-xl rounded-2xl border border-[#e9cec8] bg-white p-6 text-left shadow-sm"
                    >
                      <p className="font-semibold text-[#623b44]">
                        Descartar os dados desta prévia?
                      </p>
                      <p className="mt-2 text-sm text-[#806268]">
                        O rascunho ainda não foi enviado nem armazenado. Para sair, confirme o
                        descarte dos dados digitados.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="min-h-11 rounded-full bg-[#693440] px-5 text-sm font-semibold text-white"
                          onClick={finishPreviewExit}
                        >
                          {recruitment === "open"
                            ? "Descartar dados e iniciar inscrição real"
                            : "Descartar dados e fechar prévia"}
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-full border border-[#d8bfc2] px-5 text-sm font-semibold text-[#693440]"
                          onClick={() => setConfirmPreviewExit(false)}
                        >
                          Continuar preenchendo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#8a5962] underline"
                      onClick={requestPreviewExit}
                    >
                      {recruitment === "open"
                        ? "Iniciar inscrição real (novo formulário)"
                        : "Fechar prévia"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </Shell>
  );
}
